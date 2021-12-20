package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmiddleware "github.com/grafana/grafana/pkg/services/accesscontrol/middleware"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/setting"
)

type ServiceAccountsAPI struct {
	service        serviceaccounts.Service
	accesscontrol  accesscontrol.AccessControl
	RouterRegister routing.RouteRegister
	hasMigrated    bool
}

func NewServiceAccountsAPI(
	service serviceaccounts.Service,
	accesscontrol accesscontrol.AccessControl,
	routerRegister routing.RouteRegister,
) *ServiceAccountsAPI {
	// TODO: call db and update cache
	hasMigrated := true
	return &ServiceAccountsAPI{
		service:        service,
		accesscontrol:  accesscontrol,
		RouterRegister: routerRegister,
		hasMigrated:    hasMigrated,
	}
}

func (api *ServiceAccountsAPI) RegisterAPIEndpoints(
	cfg *setting.Cfg,
) {
	if !cfg.FeatureToggles["service-accounts"] {
		return
	}
	auth := acmiddleware.Middleware(api.accesscontrol)
	api.RouterRegister.Group("/api/serviceaccounts", func(serviceAccountsRoute routing.RouteRegister) {
		serviceAccountsRoute.Delete("/:serviceAccountId", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionDelete, serviceaccounts.ScopeID)), routing.Wrap(api.DeleteServiceAccount))
	})
}

func (api *ServiceAccountsAPI) DeleteServiceAccount(ctx *models.ReqContext) response.Response {
	scopeID := ctx.ParamsInt64(":serviceAccountId")
	err := api.service.DeleteServiceAccount(ctx.Req.Context(), ctx.OrgId, scopeID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Service account deletion error", err)
	}
	return response.Success("service account deleted")
}

func (api *ServiceAccountsAPI) hasMigratedServiceAccounts(ctx *models.ReqContext) response.Response {
	if api.hasMigrated {
		return response.Success("service accounts migrated")
	}
	return response.Error(http.StatusForbidden, "Service accounts not available because of no migration", nil)
}
