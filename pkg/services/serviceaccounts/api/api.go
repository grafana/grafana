package api

import (
	"errors"
	"net/http"
	"strconv"

	"time"

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
	store          serviceaccounts.Store
}

func NewServiceAccountsAPI(
	service serviceaccounts.Service,
	accesscontrol accesscontrol.AccessControl,
	routerRegister routing.RouteRegister,
	store serviceaccounts.Store,
) *ServiceAccountsAPI {
	return &ServiceAccountsAPI{
		service:        service,
		accesscontrol:  accesscontrol,
		RouterRegister: routerRegister,
		store:          store,
	}
}

func (api *ServiceAccountsAPI) RegisterAPIEndpoints(
	cfg *setting.Cfg,
) {
	if !cfg.FeatureToggles["service-accounts"] {
		return
	}

	auth := acmiddleware.Middleware(api.accesscontrol)
	api.RouterRegister.Group("/api/org/serviceaccounts", func(serviceAccountsRoute routing.RouteRegister) {
		serviceAccountsRoute.Get("/", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionRead, serviceaccounts.ScopeAll)), routing.Wrap(api.ListServiceAccounts))
		serviceAccountsRoute.Get("/:serviceAccountId", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionRead, serviceaccounts.ScopeID)), routing.Wrap(api.RetrieveServiceAccount))
		serviceAccountsRoute.Delete("/:serviceAccountId", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionDelete, serviceaccounts.ScopeID)), routing.Wrap(api.DeleteServiceAccount))
		serviceAccountsRoute.Get("/upgrade", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionCreate, serviceaccounts.ScopeID)), routing.Wrap(api.UpgradeServiceAccounts))
		serviceAccountsRoute.Post("/", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionCreate, serviceaccounts.ScopeID)), routing.Wrap(api.CreateServiceAccount))
		serviceAccountsRoute.Get("/:serviceAccountId/tokens", auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(serviceaccounts.ActionRead, serviceaccounts.ScopeID)), routing.Wrap(api.ListTokens))
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
	scopeID, err := strconv.ParseInt(web.Params(ctx.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "serviceAccountId is invalid", err)
	}
	err = api.service.DeleteServiceAccount(ctx.Req.Context(), ctx.OrgId, scopeID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Service account deletion error", err)
	}
	return response.Success("service account deleted")
}

func (api *ServiceAccountsAPI) UpgradeServiceAccounts(ctx *models.ReqContext) response.Response {
	if err := api.store.UpgradeServiceAccounts(ctx.Req.Context()); err == nil {
		return response.Success("service accounts upgraded")
	} else {
		return response.Error(500, "Internal server error", err)
	}
}

func (api *ServiceAccountsAPI) ListTokens(ctx *models.ReqContext) response.Response {
	saID, err := strconv.ParseInt(web.Params(ctx.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "serviceAccountId is invalid", err)
	}
	if saTokens, err := api.store.ListTokens(ctx.Req.Context(), ctx.OrgId, saID); err == nil {
		result := make([]*models.ApiKeyDTO, len(saTokens))
		for i, t := range saTokens {
			var expiration *time.Time = nil
			if t.Expires != nil {
				v := time.Unix(*t.Expires, 0)
				expiration = &v
			}
			result[i] = &models.ApiKeyDTO{
				Id:         t.Id,
				Name:       t.Name,
				Role:       t.Role,
				Expiration: expiration,
			}
		}

		return response.JSON(200, result)
	} else {
		return response.Error(500, "Internal server error", err)
	}
}

func (api *ServiceAccountsAPI) ListServiceAccounts(ctx *models.ReqContext) response.Response {
	serviceAccounts, err := api.store.ListServiceAccounts(ctx.Req.Context(), ctx.OrgId)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to list service accounts", err)
	}
	return response.JSON(http.StatusOK, serviceAccounts)
}

func (api *ServiceAccountsAPI) RetrieveServiceAccount(ctx *models.ReqContext) response.Response {
	scopeID, err := strconv.ParseInt(web.Params(ctx.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "serviceAccountId is invalid", err)
	}

	serviceAccount, err := api.store.RetrieveServiceAccount(ctx.Req.Context(), ctx.OrgId, scopeID)
	if err != nil {
		switch {
		case errors.Is(err, serviceaccounts.ErrServiceAccountNotFound):
			return response.Error(http.StatusNotFound, "Failed to retrieve service account", err)
		default:
			return response.Error(http.StatusInternalServerError, "Failed to retrieve service account", err)
		}
	}
	return response.JSON(http.StatusOK, serviceAccount)
}
