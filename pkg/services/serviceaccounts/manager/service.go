package manager

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/api"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ServiceAccountFeatureToggleNotFound = "FeatureToggle service-accounts not found, try adding it to your custom.ini"
)

type ServiceAccountsService struct {
	store      serviceaccounts.Store
	cfg        *setting.Cfg
	log        log.Logger
	usageStats usagestats.Service
}

func ProvideServiceAccountsService(
	cfg *setting.Cfg,
	store *sqlstore.SQLStore,
	ac accesscontrol.AccessControl,
	routeRegister routing.RouteRegister,
	usageStats usagestats.Service,
) (*ServiceAccountsService, error) {
	s := &ServiceAccountsService{
		cfg:        cfg,
		store:      database.NewServiceAccountsStore(store),
		log:        log.New("serviceaccounts"),
		usageStats: usageStats,
	}
	if err := ac.DeclareFixedRoles(role); err != nil {
		return nil, err
	}
	s.registerUsageMetrics()

	serviceaccountsAPI := api.NewServiceAccountsAPI(s, ac, routeRegister)
	serviceaccountsAPI.RegisterAPIEndpoints(cfg)
	return s, nil
}

func (sa *ServiceAccountsService) IsDisabled() error {
	if !sa.cfg.FeatureToggles["service-accounts"] {
		sa.log.Debug(ServiceAccountFeatureToggleNotFound)
		return errors.New(ServiceAccountFeatureToggleNotFound)
	}
	return nil
}

func (sa *ServiceAccountsService) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	err := sa.IsDisabled()
	if err != nil {
		return err
	}
	return sa.store.DeleteServiceAccount(ctx, orgID, serviceAccountID)
}

func (sa *ServiceAccountsService) registerUsageMetrics() {
	sa.usageStats.RegisterMetricsFunc(func(context.Context) (map[string]interface{}, error) {
		return map[string]interface{}{
			"stats.serviceaccounts.enabled.count": sa.getEnabledMetric(),
			"stats.serviceaccounts.count":         sa.store.GetMetric("stats.serviceaccounts.count"),
			// "stats.serviceaccounts.apikey.count":  sa.getServiceaccountsApikeyMetric(),
		}, nil
	})
}

func (sa *ServiceAccountsService) getEnabledMetric() interface{} {
	err := sa.IsDisabled()
	if err != nil {
		return 0
	}
	return 1
}
