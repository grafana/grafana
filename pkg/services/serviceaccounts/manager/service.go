package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
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
	store serviceaccounts.Store
	cfg   *setting.Cfg
	log   log.Logger
}

func ProvideServiceAccountsService(
	cfg *setting.Cfg,
	store *sqlstore.SQLStore,
	ac accesscontrol.AccessControl,
	routeRegister routing.RouteRegister,
) (*ServiceAccountsService, error) {
	s := &ServiceAccountsService{
		cfg:   cfg,
		store: database.NewServiceAccountsStore(store),
		log:   log.New("serviceaccounts"),
	}

	if err := RegisterRoles(ac); err != nil {
		s.log.Error("Failed to register roles", "error", err)
	}

	serviceaccountsAPI := api.NewServiceAccountsAPI(s, ac, routeRegister, s.store)
	serviceaccountsAPI.RegisterAPIEndpoints(cfg)

	return s, nil
}

func (sa *ServiceAccountsService) CreateServiceAccount(ctx context.Context, saForm *serviceaccounts.CreateServiceaccountForm) (*models.User, error) {
	if !sa.cfg.FeatureToggles["service-accounts"] {
		sa.log.Debug(ServiceAccountFeatureToggleNotFound)
		return nil, nil
	}
	return sa.store.CreateServiceAccount(ctx, saForm)
}

func (sa *ServiceAccountsService) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	if !sa.cfg.FeatureToggles["service-accounts"] {
		sa.log.Debug(ServiceAccountFeatureToggleNotFound)
		return nil
	}
	return sa.store.DeleteServiceAccount(ctx, orgID, serviceAccountID)
}

func (sa *ServiceAccountsService) Migrated(ctx context.Context, orgID int64) bool {
	// TODO: implement migration logic
	// change this to return true for development of service accounts page
	return false
}
