package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmiddleware "github.com/grafana/grafana/pkg/services/accesscontrol/middleware"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
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
		serviceAccountsRoute.Post("/", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionCreate, serviceaccounts.ScopeID)), routing.Wrap(api.CreateServiceAccount))
	})
}

// POST /api/serviceaccounts
func (api *ServiceAccountsAPI) CreateServiceAccount(c *models.ReqContext) response.Response {
	cmd := serviceaccounts.CreateServiceaccountForm{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "Bad request data", err)
	}
	user, err := api.service.CreateServiceAccount(c.Req.Context(), &cmd)
	switch {
	case errors.Is(err, serviceaccounts.ErrServiceAccountNotFound):
		return response.Error(http.StatusBadRequest, "Failed to create role with the provided name", err)
	case err != nil:
		return response.Error(http.StatusInternalServerError, "Failed to create service account", err)
	}

	return response.JSON(http.StatusCreated, user)
}

func (api *ServiceAccountsAPI) DeleteServiceAccount(ctx *models.ReqContext) response.Response {
	scopeID := ctx.ParamsInt64(":serviceAccountId")
	err := api.service.DeleteServiceAccount(ctx.Req.Context(), ctx.OrgId, scopeID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Service account deletion error", err)
	}
	return response.Success("service account deleted")
}
