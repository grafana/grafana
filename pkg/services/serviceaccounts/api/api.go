package api

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/setting"
)

type ServiceAccountsAPI struct {
	store          database.ServiceAccountsStoreImpl
	cfg            *setting.Cfg
	routerRegister routing.RouteRegister
}

func NewServiceAccountsAPI(
	store database.ServiceAccountsStoreImpl,
	cfg *setting.Cfg,
	routerRegister routing.RouteRegister,
) *ServiceAccountsAPI {
	return &ServiceAccountsAPI{
		store:          store,
		cfg:            cfg,
		routerRegister: routerRegister,
	}
}

func (api *ServiceAccountsAPI) RegisterAPIEndpoints() {
	// ServiceAccounts
	api.routerRegister.Group("/api/serviceaccounts", func(serviceAccountsRoute routing.RouteRegister) {
		serviceAccountIDScope := accesscontrol.Scope("serviceaccounts", "id", accesscontrol.Parameter(":serviceAccountId"))
		serviceAccountsRoute.Delete("/:serviceAccountId", serviceAccountIDScope, routing.Wrap(api.DeleteServiceAccount))
	})
}

func (api *ServiceAccountsAPI) DeleteServiceAccount(ctx context.Context, serviceAccountID int64) error {
	return api.store.DeleteServiceAccount(ctx, serviceAccountID)
}
