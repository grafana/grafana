package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	store    serviceaccounts.Store
	features featuremgmt.FeatureToggles
	log      log.Logger
}

func ProvideServiceAccountsService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	store *sqlstore.SQLStore,
	ac accesscontrol.AccessControl,
	routeRegister routing.RouteRegister,
) (*ServiceAccountsService, error) {
	s := &ServiceAccountsService{
		features: features,
		store:    database.NewServiceAccountsStore(store),
		log:      log.New("serviceaccounts"),
	}

	if features.IsEnabled(featuremgmt.FlagServiceAccounts) {
		if err := RegisterRoles(ac); err != nil {
			s.log.Error("Failed to register roles", "error", err)
		}
	}

	serviceaccountsAPI := api.NewServiceAccountsAPI(cfg, s, ac, routeRegister, s.store)
	serviceaccountsAPI.RegisterAPIEndpoints(features)

	return s, nil
}

func (sa *ServiceAccountsService) CreateServiceAccount(ctx context.Context, orgID int64, name string) (*serviceaccounts.ServiceAccountDTO, error) {
	if !sa.features.IsEnabled(featuremgmt.FlagServiceAccounts) {
		sa.log.Debug(ServiceAccountFeatureToggleNotFound)
		return nil, nil
	}
	return sa.store.CreateServiceAccount(ctx, orgID, name)
}

func (sa *ServiceAccountsService) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	if !sa.features.IsEnabled(featuremgmt.FlagServiceAccounts) {
		sa.log.Debug(ServiceAccountFeatureToggleNotFound)
		return nil
	}
	return sa.store.DeleteServiceAccount(ctx, orgID, serviceAccountID)
}
