package sql

import (
	"context"
	"errors"
	"fmt"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

type searchService struct {
	*services.BasicService

	backend          resource.StorageBackend
	cfg              *setting.Cfg
	features         featuremgmt.FeatureToggles
	db               infraDB.DB
	stopCh           chan struct{}
	stoppedCh        chan error
	handler          grpcserver.Provider
	tracing          trace.Tracer
	authenticator    func(ctx context.Context) (context.Context, error)
	httpServerRouter *mux.Router

	log          log.Logger
	reg          prometheus.Registerer
	docBuilders  resource.DocumentBuilderSupplier
	indexMetrics *resource.BleveIndexMetrics

	// Ring state for sharding
	ringState *RingState

	// Subservices state
	subservices *SubservicesState
}

func ProvideSearchService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db infraDB.DB,
	log log.Logger,
	reg prometheus.Registerer,
	docBuilders resource.DocumentBuilderSupplier,
	indexMetrics *resource.BleveIndexMetrics,
	searchRing *ring.Ring,
	memberlistKVConfig kv.Config,
	backend resource.StorageBackend,
	httpServerRouter *mux.Router,
) (UnifiedGrpcService, error) {
	tracer := otel.Tracer("unified-search-server")

	s := &searchService{
		backend:          backend,
		cfg:              cfg,
		features:         features,
		stopCh:           make(chan struct{}),
		stoppedCh:        make(chan error, 1),
		authenticator:    CreateAuthenticator(cfg, reg, tracer),
		tracing:          tracer,
		db:               db,
		log:              log,
		reg:              reg,
		docBuilders:      docBuilders,
		indexMetrics:     indexMetrics,
		httpServerRouter: httpServerRouter,
	}

	// Collect subservices
	var allSubservices []services.Service

	// Initialize ring lifecycler if sharding is enabled
	ringState, ringSubservices, err := InitRingLifecycler(RingConfig{
		Cfg:                cfg,
		Log:                log,
		Reg:                reg,
		MemberlistKVConfig: memberlistKVConfig,
		SearchRing:         searchRing,
	})
	if err != nil {
		return nil, err
	}
	s.ringState = ringState
	allSubservices = append(allSubservices, ringSubservices...)

	// Initialize subservices manager
	s.subservices, err = InitSubservicesManager(allSubservices)
	if err != nil {
		return nil, err
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(modules.SearchServer)

	// Register HTTP endpoints if router is provided
	s.registerHTTPEndpoints(httpServerRouter)

	return s, nil
}

func (s *searchService) registerHTTPEndpoints(httpServerRouter *mux.Router) {
	if httpServerRouter != nil && s.ringState != nil {
		httpServerRouter.Path("/prepare-downscale").Methods("GET", "POST", "DELETE").Handler(s.ringState.PrepareDownscale())
	}
}

func (s *searchService) ownsIndex(key resource.NamespacedResource) (bool, error) {
	return s.ringState.OwnsIndex(key)
}

func (s *searchService) starting(ctx context.Context) error {
	// Start subservices
	if err := s.subservices.StartSubservices(ctx); err != nil {
		return err
	}

	// Create authz client
	authzClient, err := CreateAuthzClient(s.cfg, s.features, s.tracing, s.reg)
	if err != nil {
		return err
	}

	// Create search options for the search server
	searchOptions, err := search.NewSearchOptions(s.cfg, s.docBuilders, s.indexMetrics, s.ownsIndex)
	if err != nil {
		return err
	}

	// Create the search server
	searchServer, err := NewSearchServer(SearchServerOptions{
		ServerOptions: ServerOptions{
			Backend:      s.backend,
			DB:           s.db,
			Cfg:          s.cfg,
			Tracer:       s.tracing,
			Reg:          s.reg,
			AccessClient: authzClient,
		},
		SearchOptions: searchOptions,
		IndexMetrics:  s.indexMetrics,
		OwnsIndexFn:   s.ownsIndex,
	})
	if err != nil {
		return err
	}

	// Create gRPC handler
	s.handler, err = CreateGrpcHandler(s.cfg, s.features, s.authenticator, s.tracing)
	if err != nil {
		return err
	}

	// Register search services
	err = RegisterSearchServices(s.cfg, s.handler, searchServer)
	if err != nil {
		return err
	}

	// Wait for ring to become active if sharding is enabled
	if s.ringState != nil {
		if err := s.ringState.WaitForRingActive(ctx, s.cfg.ResourceServerJoinRingTimeout); err != nil {
			return err
		}
	}

	// Start the gRPC server
	go func() {
		err := s.handler.Run(ctx)
		if err != nil {
			s.stoppedCh <- err
		} else {
			s.stoppedCh <- nil
		}
	}()
	return nil
}

// GetAddress returns the address of the gRPC server.
func (s *searchService) GetAddress() string {
	return s.handler.GetAddress()
}

func (s *searchService) running(ctx context.Context) error {
	select {
	case err := <-s.stoppedCh:
		if err != nil && !errors.Is(err, context.Canceled) {
			return err
		}
	case err := <-s.subservices.Watcher.Chan():
		return fmt.Errorf("subservice failure: %w", err)
	case <-ctx.Done():
		close(s.stopCh)
	}
	return nil
}

func (s *searchService) stopping(_ error) error {
	return s.subservices.StopSubservices()
}
