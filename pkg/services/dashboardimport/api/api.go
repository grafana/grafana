package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/web"
)

type ImportDashboardAPI struct {
	dashboardImportService dashboardimport.Service
	quotaService           QuotaService
	schemaLoaderService    SchemaLoaderService
	pluginStore            plugins.Store
	ac                     accesscontrol.AccessControl
}

func New(dashboardImportService dashboardimport.Service, quotaService QuotaService,
	schemaLoaderService SchemaLoaderService, pluginStore plugins.Store, ac accesscontrol.AccessControl) *ImportDashboardAPI {
	return &ImportDashboardAPI{
		dashboardImportService: dashboardImportService,
		quotaService:           quotaService,
		schemaLoaderService:    schemaLoaderService,
		pluginStore:            pluginStore,
		ac:                     ac,
	}
}

func (api *ImportDashboardAPI) RegisterAPIEndpoints(routeRegister routing.RouteRegister) {
	authorize := accesscontrol.Middleware(api.ac)
	routeRegister.Group("/api/dashboards", func(route routing.RouteRegister) {
		route.Post(
			"/import",
			authorize(middleware.ReqSignedIn, accesscontrol.EvalPermission(accesscontrol.ActionDashboardsCreate)),
			routing.Wrap(api.ImportDashboard),
		)
	}, middleware.ReqSignedIn)
}

func (api *ImportDashboardAPI) ImportDashboard(c *models.ReqContext) response.Response {
	req := dashboardimport.ImportDashboardRequest{}
	if err := web.Bind(c.Req, &req); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if req.PluginId == "" && req.Dashboard == nil {
		return response.Error(http.StatusUnprocessableEntity, "Dashboard must be set", nil)
	}

	limitReached, err := api.quotaService.QuotaReached(c, "dashboard")
	if err != nil {
		return response.Error(500, "failed to get quota", err)
	}

	if limitReached {
		return response.Error(403, "Quota reached", nil)
	}

	trimDefaults := c.QueryBoolWithDefault("trimdefaults", true)
	if trimDefaults && !api.schemaLoaderService.IsDisabled() {
		req.Dashboard, err = api.schemaLoaderService.DashboardApplyDefaults(req.Dashboard)
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Error while applying default value to the dashboard json", err)
		}
	}

	req.User = c.SignedInUser
	resp, err := api.dashboardImportService.ImportDashboard(c.Req.Context(), &req)
	if err != nil {
		return apierrors.ToDashboardErrorResponse(c.Req.Context(), api.pluginStore, err)
	}

	return response.JSON(http.StatusOK, resp)
}

type QuotaService interface {
	QuotaReached(c *models.ReqContext, target string) (bool, error)
}

type quotaServiceFunc func(c *models.ReqContext, target string) (bool, error)

func (fn quotaServiceFunc) QuotaReached(c *models.ReqContext, target string) (bool, error) {
	return fn(c, target)
}

type SchemaLoaderService interface {
	IsDisabled() bool
	DashboardApplyDefaults(input *simplejson.Json) (*simplejson.Json, error)
}
