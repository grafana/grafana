package manager

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/extensions/licensing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/api"
	"github.com/grafana/grafana/pkg/setting"
)

type ServiceAccounts struct {
	accesscontrol        accesscontrol.AccessControl
	bus                  bus.Bus
	cfg                  *setting.Cfg
	routerRegister       routing.RouteRegister
	token                licensing.LicenseToken
	serviceaccountsStore serviceaccounts.Store
	log                  log.Logger
}

func (s *ServiceAccounts) IsDisabled() bool {
	return !s.token.HasLicense()
}

func ProvideServiceAccounts(
	accesscontrol accesscontrol.AccessControl, bus bus.Bus, cfg *setting.Cfg, serviceaccountsStore serviceaccounts.Store,
	routeRegister routing.RouteRegister, token licensing.LicenseToken, usageStats usagestats.Service,
) (*ServiceAccounts, error) {
	s := &ServiceAccounts{
		accesscontrol:        accesscontrol,
		log:                  log.New("serviceaccount"),
		bus:                  bus,
		cfg:                  cfg,
		serviceaccountsStore: serviceaccountsStore,
		routerRegister:       routeRegister,
		token:                token,
	}

	if s.IsDisabled() {
		return s, nil
	}

	if !cfg.FeatureToggles["serviceaccounts"] {
		return nil, serviceaccounts.ErrServiceAccountsFeatureToggleNotFound
	}

	if err := s.init(); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *ServiceAccounts) init() error {
	s.log = log.New("serviceaccounts")

	serviceaccountsAPI := api.NewServiceAccountsAPI(s.serviceaccountsStore, s.token, s.routerRegister, s.accesscontrol)
	serviceaccountsAPI.RegisterAPIEndpoints()

	return nil
}
