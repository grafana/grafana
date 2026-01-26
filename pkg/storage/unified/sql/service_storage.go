package sql

import (
	"context"
	"errors"
	"fmt"

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

	// QOS state
	qos *QOSState

	// Subservices state
	subservices *SubservicesState
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
	tracer := otel.Tracer("unified-storage-server")

	s := &storageService{
		backend:        backend,
		cfg:            cfg,
		features:       features,
		stopCh:         make(chan struct{}),
		stoppedCh:      make(chan error, 1),
		authenticator:  CreateAuthenticator(cfg, reg, tracer),
		tracing:        tracer,
		db:             db,
		log:            log,
		reg:            reg,
		storageMetrics: storageMetrics,
	}

	// Collect subservices
	var allSubservices []services.Service

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
	s.BasicService = services.NewBasicService(s.starting, s.running, s.stopping).WithName(modules.StorageServer)

	return s, nil
}

func (s *storageService) starting(ctx context.Context) error {
	// Start subservices
	if err := s.subservices.StartSubservices(ctx); err != nil {
		return err
	}

	// Create authz client
	authzClient, err := CreateAuthzClient(s.cfg, s.features, s.tracing, s.reg)
	if err != nil {
		return err
	}

	// Setup overrides service if enabled
	overridesSvc, err := CreateOverridesService(context.Background(), s.cfg, s.log, s.reg, s.tracing)
	if err != nil {
		return err
	}

	// Get QOS queue if enabled
	var qosQueue QOSEnqueueDequeuer
	if s.qos != nil {
		qosQueue = s.qos.Queue
	}

	// Create the storage server
	storageServer, err := NewStorageServer(&StorageServerOptions{
		ServerOptions: ServerOptions{
			Backend:      s.backend,
			DB:           s.db,
			Cfg:          s.cfg,
			Tracer:       s.tracing,
			Reg:          s.reg,
			AccessClient: authzClient,
		},
		OverridesService: overridesSvc,
		StorageMetrics:   s.storageMetrics,
		QOSQueue:         qosQueue,
	})
	if err != nil {
		return err
	}

	// Create gRPC handler
	s.handler, err = CreateGrpcHandler(s.cfg, s.features, s.authenticator, s.tracing)
	if err != nil {
		return err
	}

	// Register storage services
	err = RegisterStorageServices(s.cfg, s.handler, storageServer)
	if err != nil {
		return err
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
func (s *storageService) GetAddress() string {
	return s.handler.GetAddress()
}

func (s *storageService) running(ctx context.Context) error {
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

func (s *storageService) stopping(_ error) error {
	return s.subservices.StopSubservices()
}
