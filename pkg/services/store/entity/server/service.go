package server

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
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
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	_ Service                    = (*service)(nil)
	_ registry.BackgroundService = (*service)(nil)
	_ registry.CanBeDisabled     = (*service)(nil)
)

func init() {
	// do nothing
}

type Service interface {
	services.NamedService
	registry.BackgroundService
	registry.CanBeDisabled
}

type service struct {
	*services.BasicService

	config *config

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

	tracing, err := tracing.ProvideService(tracingCfg)
	if err != nil {
		return nil, err
	}

	authn := &grpc.Authenticator{}

	s := &service{
		config:        newConfig(cfg),
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

func (s *service) IsDisabled() bool {
	return !s.config.enabled
}

// Run is an adapter for the BackgroundService interface.
func (s *service) Run(ctx context.Context) error {
	if err := s.start(ctx); err != nil {
		return err
	}
	return s.running(ctx)
}

func (s *service) IsOnlyTarget() bool {
	return len(s.cfg.Target) == 1 && s.cfg.Target[0] == modules.StorageServer
}

func (s *service) setupInstrumentationServer() {
	go func() {
		s.log.Debug("listening on port 8000 for metrics")
		http.Handle("/metrics", promhttp.Handler())
		// TODO make port configurable?
		err := http.ListenAndServe(":8000", nil)
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			s.log.Error("instrumentation server terminated with error", "error", err)
		}
	}()
}

func (s *service) start(ctx context.Context) error {
	// TODO: use wire

	if s.IsOnlyTarget() {
		s.setupInstrumentationServer()
	}

	// register metrics
	err := prometheus.Register(sqlstash.NewStorageMetrics())
	if err != nil {
		s.log.Debug("error registering storage server metrics", "error", err)
		return err
	}

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

func (s *service) running(ctx context.Context) error {
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
