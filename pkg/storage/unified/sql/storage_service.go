package sql

import (
	"context"
	"errors"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/dskit/services"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/authz"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/scheduler"
)

type storageService struct {
	*services.BasicService

	backend   resource.StorageBackend
	cfg       *setting.Cfg
	features  featuremgmt.FeatureToggles
	db        infraDB.DB
	stopCh    chan struct{}
	stoppedCh chan error

	handler grpcserver.Provider

	tracing trace.Tracer

	authenticator func(ctx context.Context) (context.Context, error)

	log            log.Logger
	reg            prometheus.Registerer
	storageMetrics *resource.StorageMetrics

	queue     QOSEnqueueDequeuer
	scheduler *scheduler.Scheduler

	// Subservices manager
	subservices        *services.Manager
	subservicesWatcher *services.FailureWatcher
	hasSubservices     bool
}

func ProvideStorageService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db infraDB.DB,
	log log.Logger,
	reg prometheus.Registerer,
	storageMetrics *resource.StorageMetrics,
	backend resource.StorageBackend,
) (UnifiedGrpcService, error) {
	var err error
	tracer := otel.Tracer("unified-storage-server")

	authn := NewAuthenticatorWithFallback(cfg, reg, tracer, func(ctx context.Context) (context.Context, error) {
		auth := grpc.Authenticator{Tracer: tracer}
		return auth.Authenticate(ctx)
	})

	s := &storageService{
		backend:            backend,
		cfg:                cfg,
		features:           features,
		stopCh:             make(chan struct{}),
		stoppedCh:          make(chan error, 1),
		authenticator:      authn,
		tracing:            tracer,
		db:                 db,
		log:                log,
		reg:                reg,
		storageMetrics:     storageMetrics,
		subservicesWatcher: services.NewFailureWatcher(),
	}

	subservices := []services.Service{}

	// Setup QOS if enabled
	if cfg.QOSEnabled {
		qosReg := prometheus.WrapRegistererWithPrefix("resource_server_qos_", reg)
		queue := scheduler.NewQueue(&scheduler.QueueOptions{
			MaxSizePerTenant: cfg.QOSMaxSizePerTenant,
			Registerer:       qosReg,
		})
		sched, err := scheduler.NewScheduler(queue, &scheduler.Config{
			NumWorkers: cfg.QOSNumberWorker,
			Logger:     log,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create qos scheduler: %s", err)
		}

		s.queue = queue
		s.scheduler = sched
		subservices = append(subservices, s.queue, s.scheduler)
	}

	if len(subservices) > 0 {
		s.hasSubservices = true
		s.subservices, err = services.NewManager(subservices...)
		if err != nil {
			return nil, fmt.Errorf("failed to create subservices manager: %w", err)
		}
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(modules.StorageServer)

	return s, nil
}

func (s *storageService) starting(ctx context.Context) error {
	if s.hasSubservices {
		s.subservicesWatcher.WatchManager(s.subservices)
		if err := services.StartManagerAndAwaitHealthy(ctx, s.subservices); err != nil {
			return fmt.Errorf("failed to start subservices: %w", err)
		}
	}

	authzClient, err := authz.ProvideStandaloneAuthZClient(s.cfg, s.features, s.tracing, s.reg)
	if err != nil {
		return err
	}

	// Setup overrides service if enabled
	var overridesSvc *resource.OverridesService
	if s.cfg.OverridesFilePath != "" {
		overridesSvc, err = resource.NewOverridesService(context.Background(), s.log, s.reg, s.tracing, resource.ReloadOptions{
			FilePath:     s.cfg.OverridesFilePath,
			ReloadPeriod: s.cfg.OverridesReloadInterval,
		})
		if err != nil {
			return err
		}
	}

	// Create the storage server
	storageServer, err := NewStorageServer(&StorageServerOptions{
		Backend:          s.backend,
		OverridesService: overridesSvc,
		DB:               s.db,
		Cfg:              s.cfg,
		Tracer:           s.tracing,
		Reg:              s.reg,
		AccessClient:     authzClient,
		StorageMetrics:   s.storageMetrics,
		Features:         s.features,
		QOSQueue:         s.queue,
	})
	if err != nil {
		return err
	}

	s.handler, err = grpcserver.ProvideService(s.cfg, s.features, interceptors.AuthenticatorFunc(s.authenticator), s.tracing, prometheus.DefaultRegisterer)
	if err != nil {
		return err
	}

	healthService, err := resource.ProvideHealthService(storageServer)
	if err != nil {
		return err
	}

	srv := s.handler.GetServer()
	// Register storage services
	resourcepb.RegisterResourceStoreServer(srv, storageServer)
	resourcepb.RegisterBulkStoreServer(srv, storageServer)
	resourcepb.RegisterBlobStoreServer(srv, storageServer)
	resourcepb.RegisterDiagnosticsServer(srv, storageServer)
	resourcepb.RegisterQuotasServer(srv, storageServer)
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
func (s *storageService) GetAddress() string {
	return s.handler.GetAddress()
}

func (s *storageService) running(ctx context.Context) error {
	select {
	case err := <-s.stoppedCh:
		if err != nil && !errors.Is(err, context.Canceled) {
			return err
		}
	case err := <-s.subservicesWatcher.Chan():
		return fmt.Errorf("subservice failure: %w", err)
	case <-ctx.Done():
		close(s.stopCh)
	}
	return nil
}

func (s *storageService) stopping(_ error) error {
	if s.hasSubservices {
		err := services.StopManagerAndAwaitStopped(context.Background(), s.subservices)
		if err != nil {
			return fmt.Errorf("failed to stop subservices: %w", err)
		}
	}
	return nil
}
