package server

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/store/entity/db/dbimpl"
	"github.com/grafana/grafana/pkg/services/store/entity/grpc"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ Service                    = (*EntityService)(nil)
	_ registry.BackgroundService = (*EntityService)(nil)
	_ registry.CanBeDisabled     = (*EntityService)(nil)
)

func init() {
	// do nothing
}

type Service interface {
	services.NamedService
	registry.BackgroundService
	registry.CanBeDisabled
}

type EntityService struct {
	*services.BasicService

	config *config

	cfg      *setting.Cfg
	features featuremgmt.FeatureToggles

	stopCh    chan struct{}
	stoppedCh chan error

	handler grpcserver.Provider

	tracing *tracing.TracingService

	authenticator interceptors.Authenticator
}

func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
) (*EntityService, error) {
	tracingCfg, err := tracing.ProvideTracingConfig(cfg)
	if err != nil {
		return nil, err
	}

	tracing, err := tracing.ProvideService(tracingCfg)
	if err != nil {
		return nil, err
	}

	authn := &grpc.Authenticator{}

	s := &EntityService{
		config:        newConfig(cfg),
		cfg:           cfg,
		features:      features,
		stopCh:        make(chan struct{}),
		authenticator: authn,
		tracing:       tracing,
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.StorageServer)

	return s, nil
}

func (s *EntityService) IsDisabled() bool {
	return !s.config.enabled
}

// Run is an adapter for the BackgroundService interface.
func (s *EntityService) Run(ctx context.Context) error {
	if err := s.start(ctx); err != nil {
		return err
	}
	return s.running(ctx)
}

func (s *EntityService) start(ctx context.Context) error {
	// TODO: use wire

	// TODO: support using grafana db connection?
	eDB, err := dbimpl.ProvideEntityDB(nil, s.cfg, s.features)
	if err != nil {
		return err
	}

	err = eDB.Init()
	if err != nil {
		return err
	}

	store, err := sqlstash.ProvideSQLEntityServer(eDB)
	if err != nil {
		return err
	}

	s.handler, err = grpcserver.ProvideService(s.cfg, s.features, s.authenticator, s.tracing, prometheus.DefaultRegisterer)
	if err != nil {
		return err
	}

	entity.RegisterEntityStoreServer(s.handler.GetServer(), store)

	err = s.handler.Run(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (s *EntityService) running(ctx context.Context) error {
	// skip waiting for the server in prod mode
	if !s.config.devMode {
		<-ctx.Done()
		return nil
	}

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
