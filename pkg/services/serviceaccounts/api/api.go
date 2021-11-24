package api

import (
	"errors"
	"fmt"
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
}

func NewServiceAccountsAPI(
	service serviceaccounts.Service,
	accesscontrol accesscontrol.AccessControl,
	routerRegister routing.RouteRegister,
) *ServiceAccountsAPI {
	return &ServiceAccountsAPI{
		service:        service,
		accesscontrol:  accesscontrol,
		RouterRegister: routerRegister,
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
		serviceAccountsRoute.Post("/:serviceAccountId", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionDelete, serviceaccounts.ScopeID)), routing.Wrap(api.DeleteServiceAccount))
	})
}

// POST /api/access-control/roles
func (api *ServiceAccountsAPI) createServiceAccount(c *models.ReqContext, cmd serviceaccounts.CreateServiceaccountForm) response.Response {

	err := api.service.CreateServiceAccount(c.Req.Context(), cmd)
	switch {
	case errors.Is(err, serviceaccounts.ErrServiceAccountNotFound):
		return response.Error(http.StatusBadRequest, "Failed to create role with the provided name", err)
	case err != nil:
		return response.Error(http.StatusInternalServerError, "Failed to create service account", err)
	}

	return response.JSON(http.StatusCreated, role).SetHeader("Location", fmt.Sprintf("/api/access-control/roles/%s", createRoleCmd.UID))
}

func (api *ServiceAccountsAPI) DeleteServiceAccount(ctx *models.ReqContext) response.Response {
	scopeID := ctx.ParamsInt64(":serviceAccountId")
	err := api.service.DeleteServiceAccount(ctx.Req.Context(), ctx.OrgId, scopeID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Service account deletion error", err)
	}
	return response.Success("service account deleted")
}
