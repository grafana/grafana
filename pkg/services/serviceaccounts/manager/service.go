package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
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
	if err := ac.DeclareFixedRoles(role); err != nil {
		return nil, err
	}
	serviceaccountsAPI := api.NewServiceAccountsAPI(s, ac, routeRegister)
	serviceaccountsAPI.RegisterAPIEndpoints(cfg)

	basicKeys := store.GetNonServiceAccountAPIKeys(context.Background())
	if len(basicKeys) > 0 {
		s.log.Info("Launching background thread to upgrade API keys to service accounts", "numberKeys", len(basicKeys))
		go func() {
			for _, key := range basicKeys {
				sa, err := store.CreateServiceAccountForApikey(context.Background(), key.OrgId, key.Name, key.Role)
				if err != nil {
					s.log.Error("Failed to create service account for API key", "err", err, "keyId", key.Id)
					continue
				}

				err = store.UpdateApikeyServiceAccount(context.Background(), key.Id, sa.Id)
				if err != nil {
					s.log.Error("Failed to attach new service account to API key", "err", err, "keyId", key.Id, "newServiceAccountId", sa.Id)
					continue
				}
				s.log.Debug("Updated basic api key", "keyId", key.Id, "newServiceAccountId", sa.Id)
			}
		}()
	}

	return s, nil
}

func (s *ServiceAccountsService) DeleteServiceAccount(ctx context.Context, orgID, serviceAccountID int64) error {
	if !s.cfg.FeatureToggles["service-accounts"] {
		s.log.Debug(ServiceAccountFeatureToggleNotFound)
		return nil
	}
	return s.store.DeleteServiceAccount(ctx, orgID, serviceAccountID)
}
