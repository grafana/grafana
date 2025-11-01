package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboardimport"
	"github.com/grafana/grafana/pkg/services/dashboardimport/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/web"
)

type ImportDashboardAPI struct {
	dashboardImportService dashboardimport.Service
	quotaService           QuotaService
	pluginStore            pluginstore.Store
	ac                     accesscontrol.AccessControl
	features               featuremgmt.FeatureToggles
}

func New(dashboardImportService dashboardimport.Service, quotaService QuotaService,
	pluginStore pluginstore.Store, ac accesscontrol.AccessControl, features featuremgmt.FeatureToggles) *ImportDashboardAPI {
	return &ImportDashboardAPI{
		dashboardImportService: dashboardImportService,
		quotaService:           quotaService,
		pluginStore:            pluginStore,
		ac:                     ac,
		features:               features,
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
		//nolint:staticcheck // not yet migrated to OpenFeature
		if api.features.IsEnabledGlobally(featuremgmt.FlagDashboardLibrary) {
			route.Post(
				"/interpolate",
				authorize(accesscontrol.EvalPermission(dashboards.ActionDashboardsCreate)),
				routing.Wrap(api.InterpolateDashboard),
			)
		}
	}, middleware.ReqSignedIn)
}

// swagger:route POST /dashboards/interpolate dashboards interpolateDashboard
//
// Interpolate dashboard. This is an experimental endpoint under dashboardLibrary FF and is subject to change.
//
// Responses:
// 200: interpolateDashboardResponse
// 400: badRequestError
// 401: unauthorisedError
// 422: unprocessableEntityError
// 500: internalServerError
func (api *ImportDashboardAPI) InterpolateDashboard(c *contextmodel.ReqContext) response.Response {
	req := dashboardimport.ImportDashboardRequest{}
	if err := web.Bind(c.Req, &req); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	if req.PluginId == "" && req.Dashboard == nil {
		return response.Error(http.StatusUnprocessableEntity, "pluginId or dashboard must be set", nil)
	}

	resp, err := api.dashboardImportService.InterpolateDashboard(c.Req.Context(), &req)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to interpolate dashboard", err)
	}

	resp.Del("__elements")
	resp.Del("__inputs")
	resp.Del("__requires")

	return response.JSON(http.StatusOK, resp)
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
		return response.Error(http.StatusForbidden, "Quota reached", nil)
	}

	req.User = c.SignedInUser
	resp, err := api.dashboardImportService.ImportDashboard(c.Req.Context(), &req)
	if err != nil {
		if errors.Is(err, utils.ErrDashboardInputMissing) {
			return response.Error(http.StatusBadRequest, err.Error(), err)
		}
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

// swagger:response interpolateDashboardResponse
type InterpolateDashboardResponse struct {
	// in: body
	Body interface{} `json:"body"`
}
