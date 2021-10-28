package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/extensions/licensing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmiddleware "github.com/grafana/grafana/pkg/services/accesscontrol/middleware"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
)

type ServiceAccountsAPI struct {
	serviceaccountsDatabase serviceaccounts.Store
	token                   licensing.LicenseToken
	routeRegister           routing.RouteRegister
	accesscontrol           accesscontrol.AccessControl
}

func NewServiceAccountsAPI(
	serviceaccountDatabase serviceaccounts.Store,
	token licensing.LicenseToken,
	routerRegister routing.RouteRegister,
	accesscontrol accesscontrol.AccessControl,
) *ServiceAccountsAPI {
	return &ServiceAccountsAPI{
		serviceaccountsDatabase: serviceaccountDatabase,
		token:                   token,
		routeRegister:           routerRegister,
		accesscontrol:           accesscontrol,
	}
}

func (api *ServiceAccountsAPI) RegisterAPIEndpoints() {

	authorize := acmiddleware.Middleware(api.accesscontrol)
	// ServiceAccounts
	api.routeRegister.Group("/api/serviceaccounts", func(serviceAccountsRoute routing.RouteRegister) {
		serviceAccountIDScope := accesscontrol.Scope("serviceaccounts", "id", accesscontrol.Parameter(":serviceAccountId"))
		serviceAccountsRoute.Delete("/:serviceAccountId", authorize(middleware.ReqGrafanaAdmin, accesscontrol.EvalPermission(accesscontrol.ActionOrgUsersRemove, serviceAccountIDScope)), routing.Wrap(api.deleteServiceAccount))
	}, api.token.Middleware(true))
}

func (api *ServiceAccountsAPI) deleteServiceAccount(c *models.ReqContext) response.Response {
	serviceAccountId := c.ParamsInt64(":serviceAccountId")
	err := api.serviceaccountsDatabase.DeleteServiceAccount(c.Req.Context(), serviceAccountId)
	if err != nil {
		return response.Error(http.StatusInternalServerError, fmt.Sprintf("Failed to delete service account for serviceAccountId %d", serviceAccountId), err)
	}
	return response.Success("Service account removed.")
}
