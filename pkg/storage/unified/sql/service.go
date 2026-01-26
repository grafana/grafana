package sql

import (
	"context"
	"fmt"
	"time"

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

var (
	_ UnifiedGrpcService = (*service)(nil)
	_ UnifiedGrpcService = (*searchService)(nil)
	_ UnifiedGrpcService = (*storageService)(nil)
)

type UnifiedGrpcService interface {
	services.NamedService

	// Return the address where this service is running
	GetAddress() string
}

type service struct {
	*services.BasicService

	backend       resource.StorageBackend
	serverStopper resource.ResourceServerStopper
	cfg           *setting.Cfg
	features      featuremgmt.FeatureToggles
	db            infraDB.DB

	tracing trace.Tracer

	authenticator func(ctx context.Context) (context.Context, error)

	log            log.Logger
	reg            prometheus.Registerer
	docBuilders    resource.DocumentBuilderSupplier
	storageMetrics *resource.StorageMetrics
	indexMetrics   *resource.BleveIndexMetrics

	// Handler for the gRPC server
	handler grpcserver.Provider

	// Ring state for sharding
	ringState *RingState

	// QOS state
	qos *QOSState

	// Subservices state
	subservices *SubservicesState
}

// ProvideUnifiedStorageGrpcService provides a combined storage and search service running on the same gRPC server.
// This is used when running Grafana as a monolith where both services share the same process.
// Each service (storage and search) maintains its own lifecycle but shares the gRPC server.
// Deprecated: use ProvideStorageService and ProvideSearchService instead.
func ProvideUnifiedStorageGrpcService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db infraDB.DB,
	log log.Logger,
	reg prometheus.Registerer,
	docBuilders resource.DocumentBuilderSupplier,
	storageMetrics *resource.StorageMetrics,
	indexMetrics *resource.BleveIndexMetrics,
	searchRing *ring.Ring,
	memberlistKVConfig kv.Config,
	httpServerRouter *mux.Router,
	backend resource.StorageBackend,
) (UnifiedGrpcService, error) {
	tracer := otel.Tracer("unified-storage")

	s := &service{
		backend:        backend,
		cfg:            cfg,
		features:       features,
		authenticator:  CreateAuthenticator(cfg, reg, tracer),
		tracing:        tracer,
		db:             db,
		log:            log,
		reg:            reg,
		docBuilders:    docBuilders,
		storageMetrics: storageMetrics,
		indexMetrics:   indexMetrics,
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

	// Register HTTP endpoints for ring management
	if httpServerRouter != nil && ringState != nil {
		httpServerRouter.Path("/prepare-downscale").Methods("GET", "POST", "DELETE").Handler(ringState.PrepareDownscale())
	}

	// Initialize QOS if enabled
	qosState, qosSubservices, err := InitQOS(QOSConfig{
		Cfg: cfg,
		Log: log,
		Reg: reg,
	})
	if err != nil {
		return nil, err
	}
	s.qos = qosState
	allSubservices = append(allSubservices, qosSubservices...)

	// Initialize subservices manager
	s.subservices, err = InitSubservicesManager(allSubservices)
	if err != nil {
		return nil, err
	}

	// This will be used when running as a dskit service
	// Note: We use StorageServer as the module name for backward compatibility
	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(modules.StorageServer)

	return s, nil
}

func (s *service) ownsIndex(key resource.NamespacedResource) (bool, error) {
	return s.ringState.OwnsIndex(key)
}

func (s *service) starting(ctx context.Context) error {
	// Start subservices
	if err := s.subservices.StartSubservices(ctx); err != nil {
		return err
	}

	// Create authz client
	authzClient, err := CreateAuthzClient(s.cfg, s.features, s.tracing, s.reg)
	if err != nil {
		return err
	}

	// Get QOS queue if enabled
	var qosQueue QOSEnqueueDequeuer
	if s.qos != nil {
		qosQueue = s.qos.Queue
	}

	serverOptions := &ResourceServerOptions{
		ServerOptions: ServerOptions{
			Backend:      s.backend,
			DB:           s.db,
			Cfg:          s.cfg,
			Tracer:       s.tracing,
			Reg:          s.reg,
			AccessClient: authzClient,
		},
		StorageMetrics: s.storageMetrics,
		QOSQueue:       qosQueue,
		OwnsIndexFn:    s.ownsIndex,
		IndexMetrics:   s.indexMetrics,
	}

	// Create search options for the search server
	if s.cfg.EnableSearch {
		searchOptions, err := search.NewSearchOptions(s.cfg, s.docBuilders, s.indexMetrics, s.ownsIndex)
		if err != nil {
			return err
		}
		serverOptions.SearchOptions = &searchOptions
	}

	// Setup overrides service if enabled
	overridesSvc, err := CreateOverridesService(context.Background(), s.cfg, s.log, s.reg, s.tracing)
	if err != nil {
		return err
	}
	serverOptions.OverridesService = overridesSvc

	server, err := NewResourceServer(serverOptions)
	if err != nil {
		return err
	}
	s.serverStopper = server

	// Create gRPC handler
	s.handler, err = CreateGrpcHandler(s.cfg, s.features, s.authenticator, s.tracing)
	if err != nil {
		return err
	}

	// Register unified services (storage + search)
	err = RegisterUnifiedServices(s.cfg, s.handler, server)
	if err != nil {
		return err
	}

	// Wait for ring to become active if sharding is enabled
	if s.ringState != nil {
		if err := s.ringState.WaitForRingActive(ctx, s.cfg.ResourceServerJoinRingTimeout); err != nil {
			return err
		}
	}

	return nil
}

// GetAddress returns the address of the gRPC server.
func (s *service) GetAddress() string {
	return s.handler.GetAddress()
}

func (s *service) running(ctx context.Context) error {
	serverErrCh := make(chan error, 1)
	go func() {
		serverErrCh <- s.handler.Run(ctx)
	}()

	select {
	case err := <-serverErrCh:
		if err != nil {
			return err
		}
		return nil
	case err := <-s.subservices.Watcher.Chan():
		return fmt.Errorf("subservice failure: %w", err)
	case <-ctx.Done():
		s.log.Info("Stopping resource server")
		if s.serverStopper != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := s.serverStopper.Stop(ctx); err != nil {
				s.log.Warn("Failed to stop resource server", "error", err)
			} else {
				s.log.Info("Resource server stopped")
			}
		}

		// Now wait for the gRPC server to complete graceful shutdown.
		s.log.Info("Waiting for gRPC server to complete graceful shutdown")
		err := <-serverErrCh
		if err != nil {
			return err
		}
		return nil
	}
}

func (s *service) stopping(_ error) error {
	return s.subservices.StopSubservices()
}
