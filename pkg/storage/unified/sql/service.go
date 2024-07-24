package sql

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"google.golang.org/grpc/health/grpc_health_v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
)

var (
	_ Service = (*service)(nil)
	// _ registry.BackgroundService = (*service)(nil)
	// _ registry.CanBeDisabled     = (*service)(nil)
)

type Service interface {
	services.NamedService
	// registry.BackgroundService
	// registry.CanBeDisabled To we need to implement this interface?
}

type service struct {
	*services.BasicService

	// config *c
	cfg      *setting.Cfg
	features featuremgmt.FeatureToggles

	stopCh    chan struct{}
	stoppedCh chan error

	handler grpcserver.Provider

	tracing *tracing.TracingService

	authenticator interceptors.Authenticator

	log log.Logger
}

func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	log log.Logger,
) (*service, error) {
	tracingCfg, err := tracing.ProvideTracingConfig(cfg)
	if err != nil {
		return nil, err
	}
	tracingCfg.ServiceName = "unified-storage"

	tracing, err := tracing.ProvideService(tracingCfg)
	if err != nil {
		return nil, err
	}

	authn := &grpc.Authenticator{}

	s := &service{
		// config:        newConfig(cfg),
		cfg:           cfg,
		features:      features,
		stopCh:        make(chan struct{}),
		authenticator: authn,
		tracing:       tracing,
		log:           log,
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.StorageServer)

	return s, nil
}

// // Run is an adapter for the BackgroundService interface.
// func (s *service) Run(ctx context.Context) error {
// 	if err := s.start(ctx); err != nil {
// 		return err
// 	}
// 	return s.running(ctx)
// }

func (s *service) start(ctx context.Context) error {
	server, err := ProvideResourceServer(nil, s.cfg, s.features, s.tracing)
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

	resource.RegisterResourceStoreServer(s.handler.GetServer(), server)
	grpc_health_v1.RegisterHealthServer(s.handler.GetServer(), healthService)

	// register reflection service
	_, err = grpcserver.ProvideReflectionService(s.cfg, s.handler)
	if err != nil {
		return err
	}

	err = s.handler.Run(ctx)
	if err != nil {
		return err
	}

	return nil
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
