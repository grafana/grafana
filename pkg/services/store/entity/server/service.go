package server

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/services/store/entity"
	entityDB "github.com/grafana/grafana/pkg/services/store/entity/db"
	"github.com/grafana/grafana/pkg/services/store/entity/sqlstash"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
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
}

type fakeAuthenticator struct{}

func (f *fakeAuthenticator) Authenticate(ctx context.Context) (context.Context, error) {
	return appcontext.WithUser(ctx, &user.SignedInUser{
		Login:  "admin",
		UserID: 1,
		OrgID:  1,
	}), nil
}

var _ interceptors.Authenticator = (*fakeAuthenticator)(nil)

func ProvideService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
) (*service, error) {
	tracing, err := tracing.ProvideService(cfg)
	if err != nil {
		return nil, err
	}

	authn := &fakeAuthenticator{}

	s := &service{
		config:        newConfig(cfg),
		cfg:           cfg,
		features:      features,
		stopCh:        make(chan struct{}),
		authenticator: authn,
		tracing:       tracing,
	}

	// This will be used when running as a dskit service
	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.StorageAPIServer)

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

func (s *service) start(ctx context.Context) error {
	eDB, err := entityDB.ProvideEntityDB(nil, s.cfg, s.features)
	if err != nil {
		return err
	}

	store, err := sqlstash.ProvideSQLEntityServer(eDB)
	if err != nil {
		return err
	}

	s.handler, err = grpcserver.ProvideService(s.cfg, s.authenticator, s.tracing, prometheus.DefaultRegisterer)
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
