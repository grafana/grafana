package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/web"
)

type ImportDashboardAPI struct {
	dashboardImportService dashboardimport.Service
	quotaService           QuotaService
	pluginStore            plugins.Store
	ac                     accesscontrol.AccessControl
}

func New(dashboardImportService dashboardimport.Service, quotaService QuotaService,
	pluginStore plugins.Store, ac accesscontrol.AccessControl) *ImportDashboardAPI {
	return &ImportDashboardAPI{
		dashboardImportService: dashboardImportService,
		quotaService:           quotaService,
		pluginStore:            pluginStore,
		ac:                     ac,
	}
}

func (api *ImportDashboardAPI) RegisterAPIEndpoints(routeRegister routing.RouteRegister) {
	authorize := accesscontrol.Middleware(api.ac)
	routeRegister.Group("/api/dashboards", func(route routing.RouteRegister) {
		route.Post(
			"/import",
			authorize(accesscontrol.EvalPermission(dashboards.ActionDashboardsCreate)),
			routing.Wrap(api.ImportDashboard),
		)
	}, middleware.ReqSignedIn)
}

// swagger:route POST /dashboards/import dashboards importDashboard
//
// Import dashboard.
//
// Responses:
// 200: importDashboardResponse
// 400: badRequestError
// 401: unauthorisedError
// 412: preconditionFailedError
// 422: unprocessableEntityError
// 500: internalServerError
func (api *ImportDashboardAPI) ImportDashboard(c *contextmodel.ReqContext) response.Response {
	req := dashboardimport.ImportDashboardRequest{}
	if err := web.Bind(c.Req, &req); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if req.PluginId == "" && req.Dashboard == nil {
		return response.Error(http.StatusUnprocessableEntity, "Dashboard must be set", nil)
	}

	limitReached, err := api.quotaService.QuotaReached(c, dashboards.QuotaTargetSrv)
	if err != nil {
		return response.Err(err)
	}

	if limitReached {
		return response.Error(403, "Quota reached", nil)
	}

	req.User = c.SignedInUser
	resp, err := api.dashboardImportService.ImportDashboard(c.Req.Context(), &req)
	if err != nil {
		return apierrors.ToDashboardErrorResponse(c.Req.Context(), api.pluginStore, err)
	}

	return response.JSON(http.StatusOK, resp)
}

type QuotaService interface {
	QuotaReached(c *contextmodel.ReqContext, target quota.TargetSrv) (bool, error)
}

type quotaServiceFunc func(c *contextmodel.ReqContext, target quota.TargetSrv) (bool, error)

func (fn quotaServiceFunc) QuotaReached(c *contextmodel.ReqContext, target quota.TargetSrv) (bool, error) {
	return fn(c, target)
}

// swagger:parameters importDashboard
type ImportDashboardParams struct {
	// in:body
	// required:true
	Body dashboardimport.ImportDashboardRequest
}

// swagger:response importDashboardResponse
type ImportDashboardResponse struct {
	// in: body
	Body dashboardimport.ImportDashboardResponse `json:"body"`
}
