package sql

import (
	"context"

	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/dskit/services"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/authn/grpcutils"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

var (
	_ UnifiedStorageGrpcService = (*service)(nil)
)

type UnifiedStorageGrpcService interface {
	services.NamedService

	// Return the address where this service is running
	GetAddress() string
}

type service struct {
	*services.BasicService

	cfg       *setting.Cfg
	features  featuremgmt.FeatureToggles
	db        infraDB.DB
	stopCh    chan struct{}
	stoppedCh chan error

	handler grpcserver.Provider

	tracing *tracing.TracingService

	authenticator interceptors.Authenticator

	log            log.Logger
	reg            prometheus.Registerer
	storageMetrics *resource.StorageMetrics

	docBuilders resource.DocumentBuilderSupplier
}

func ProvideUnifiedStorageGrpcService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db infraDB.DB,
	log log.Logger,
	reg prometheus.Registerer,
	docBuilders resource.DocumentBuilderSupplier,
	storageMetrics *resource.StorageMetrics,
) (UnifiedStorageGrpcService, error) {
	tracingCfg, err := tracing.ProvideTracingConfig(cfg)
	if err != nil {
		return nil, err
	}
	tracingCfg.ServiceName = "unified-storage"

	tracing, err := tracing.ProvideService(tracingCfg)
	if err != nil {
		return nil, err
	}

	// reg can be nil when running unified storage in standalone mode
	if reg == nil {
		reg = prometheus.DefaultRegisterer
	}

	// FIXME: This is a temporary solution while we are migrating to the new authn interceptor
	// grpcutils.NewGrpcAuthenticator should be used instead.
	authn := grpcutils.NewAuthenticatorWithFallback(cfg, reg, tracing, &grpc.Authenticator{Tracer: tracing})

	s := &service{
		cfg:            cfg,
		features:       features,
		stopCh:         make(chan struct{}),
		authenticator:  authn,
		tracing:        tracing,
		db:             db,
		log:            log,
		reg:            reg,
		docBuilders:    docBuilders,
		storageMetrics: storageMetrics,
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.StorageServer)

	return s, nil
}

func (s *service) start(ctx context.Context) error {
	authzClient, err := authz.ProvideStandaloneAuthZClient(s.cfg, s.features, s.tracing)
	if err != nil {
		return err
	}

	searchOptions, err := search.NewSearchOptions(s.features, s.cfg, s.tracing, s.docBuilders, s.reg)
	if err != nil {
		return err
	}

	server, err := NewResourceServer(s.db, s.cfg, s.tracing, s.reg, authzClient, searchOptions, s.storageMetrics)
	if err != nil {
		return err
	}
	s.handler, err = grpcserver.ProvideService(s.cfg, s.features, s.authenticator, s.tracing, prometheus.DefaultRegisterer)
	if err != nil {
		return err
	}

	healthService, err := resource.ProvideHealthService(server)
	if err != nil {
		return err
	}

	srv := s.handler.GetServer()
	resource.RegisterResourceStoreServer(srv, server)
	resource.RegisterBulkStoreServer(srv, server)
	resource.RegisterResourceIndexServer(srv, server)
	resource.RegisterRepositoryIndexServer(srv, server)
	resource.RegisterBlobStoreServer(srv, server)
	resource.RegisterDiagnosticsServer(srv, server)
	grpc_health_v1.RegisterHealthServer(srv, healthService)

	// register reflection service
	_, err = grpcserver.ProvideReflectionService(s.cfg, s.handler)
	if err != nil {
		return err
	}

	// start the gRPC server
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
func (s *service) GetAddress() string {
	return s.handler.GetAddress()
}

func (s *service) running(ctx context.Context) error {
	select {
	case err := <-s.stoppedCh:
		if err != nil {
			return err
		}
	case <-ctx.Done():
		close(s.stopCh)
	}
	return nil
}
