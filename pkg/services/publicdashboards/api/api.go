package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

type Api struct {
	PublicDashboardService publicdashboards.Service
	RouteRegister          routing.RouteRegister
	AccessControl          accesscontrol.AccessControl
	Features               *featuremgmt.FeatureManager
	Log                    log.Logger
}

func ProvideApi(
	pd publicdashboards.Service,
	rr routing.RouteRegister,
	ac accesscontrol.AccessControl,
	features *featuremgmt.FeatureManager,
) *Api {
	api := &Api{
		PublicDashboardService: pd,
		RouteRegister:          rr,
		AccessControl:          ac,
		Features:               features,
		Log:                    log.New("publicdashboards.api"),
	}

	// attach api if PublicDashboards feature flag is enabled
	if features.IsEnabled(featuremgmt.FlagPublicDashboards) {
		api.RegisterAPIEndpoints()
	}

	return api
}

// RegisterAPIEndpoints Registers Endpoints on Grafana Router
func (api *Api) RegisterAPIEndpoints() {
	// Public endpoints
	// Anonymous access to public dashboard route is configured in pkg/api/api.go
	// because it is deeply dependent on the HTTPServer.Index() method and would result in a
	// circular dependency

	api.RouteRegister.Get("/api/public/dashboards/:accessToken", routing.Wrap(api.ViewPublicDashboard))
	api.RouteRegister.Post("/api/public/dashboards/:accessToken/panels/:panelId/query", routing.Wrap(api.QueryPublicDashboard))
	api.RouteRegister.Get("/api/public/dashboards/:accessToken/annotations", routing.Wrap(api.GetAnnotations))

	// Auth endpoints
	auth := accesscontrol.Middleware(api.AccessControl)
	uidScope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(accesscontrol.Parameter(":dashboardUid"))

	// List public dashboards for org
	api.RouteRegister.Get("/api/dashboards/public-dashboards", middleware.ReqSignedIn, routing.Wrap(api.ListPublicDashboards))

	// Get public dashboard
	api.RouteRegister.Get("/api/dashboards/uid/:dashboardUid/public-dashboards",
		auth(middleware.ReqSignedIn, accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, uidScope)),
		routing.Wrap(api.GetPublicDashboard))

	// Create Public Dashboard
	api.RouteRegister.Post("/api/dashboards/uid/:dashboardUid/public-dashboards",
		auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(dashboards.ActionDashboardsPublicWrite, uidScope)),
		routing.Wrap(api.CreatePublicDashboard))

	// Update Public Dashboard
	api.RouteRegister.Put("/api/dashboards/uid/:dashboardUid/public-dashboards",
		auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(dashboards.ActionDashboardsPublicWrite, uidScope)),
		routing.Wrap(api.UpdatePublicDashboard))

	// Delete Public dashboard
	api.RouteRegister.Delete("/api/dashboards/uid/:dashboardUid/public-dashboards/:uid",
		auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(dashboards.ActionDashboardsPublicWrite, uidScope)),
		routing.Wrap(api.DeletePublicDashboard))
}

// ListPublicDashboards Gets list of public dashboards for an org
// GET /api/dashboards/public
func (api *Api) ListPublicDashboards(c *models.ReqContext) response.Response {
	resp, err := api.PublicDashboardService.FindAll(c.Req.Context(), c.SignedInUser, c.OrgID)
	if err != nil {
		return api.handleError(c.Req.Context(), http.StatusInternalServerError, "ListPublicDashboards: failed to list public dashboards", err)
	}
	return response.JSON(http.StatusOK, resp)
}

// GetPublicDashboard Gets public dashboard for dashboard
// GET /api/dashboards/uid/:uid/public-dashboards
func (api *Api) GetPublicDashboard(c *models.ReqContext) response.Response {
	// exit if we don't have a valid dashboardUid
	dashboardUid := web.Params(c.Req)[":dashboardUid"]
	if dashboardUid == "" || !util.IsValidShortUID(dashboardUid) {
		api.handleError(c.Req.Context(), http.StatusBadRequest, "GetPublicDashboard: no valid dashboardUid", dashboards.ErrDashboardIdentifierNotSet)
	}

	pdc, err := api.PublicDashboardService.FindByDashboardUid(c.Req.Context(), c.OrgID, web.Params(c.Req)[":dashboardUid"])

	if err != nil {
		return api.handleError(c.Req.Context(), http.StatusInternalServerError, "GetPublicDashboard: failed to get public dashboard ", err)
	}

	if pdc == nil {
		return api.handleError(c.Req.Context(), http.StatusNotFound, "GetPublicDashboard: public dashboard not found", ErrPublicDashboardNotFound)
	}

	return response.JSON(http.StatusOK, pdc)
}

// SavePublicDashboard Sets public dashboard for dashboard
// POST /api/dashboards/uid/:uid/public-dashboards
func (api *Api) CreatePublicDashboard(c *models.ReqContext) response.Response {
	// exit if we don't have a valid dashboardUid
	dashboardUid := web.Params(c.Req)[":dashboardUid"]
	if dashboardUid == "" || !util.IsValidShortUID(dashboardUid) {
		api.handleError(c.Req.Context(), http.StatusBadRequest, "SavePublicDashboard: invalid dashboardUid", dashboards.ErrDashboardIdentifierNotSet)
	}

	pubdash := &PublicDashboard{}
	if err := web.Bind(c.Req, pubdash); err != nil {
		return response.Error(http.StatusBadRequest, "CreatePublicDashboard: bad request data", err)
	}

	// Always set the orgID and userID from the session
	pubdash.OrgId = c.OrgID
	dto := SavePublicDashboardDTO{
		UserId:          c.UserID,
		OrgId:           c.OrgID,
		DashboardUid:    dashboardUid,
		PublicDashboard: pubdash,
	}

	// Save the public dashboard
	pubdash, err := api.PublicDashboardService.Save(c.Req.Context(), c.SignedInUser, &dto)
	if err != nil {
		return api.handleError(c.Req.Context(), http.StatusInternalServerError, "CreatePublicDashboard: failed to save public dashboard", err)
	}

	return response.JSON(http.StatusOK, pubdash)
}

// UpdatePublicDashboard Sets public dashboard for dashboard
// PUT /api/dashboards/uid/:uid/public-dashboards
func (api *Api) UpdatePublicDashboard(c *models.ReqContext) response.Response {
	// exit if we don't have a valid dashboardUid
	dashboardUid := web.Params(c.Req)[":dashboardUid"]
	if dashboardUid == "" || !util.IsValidShortUID(dashboardUid) {
		api.handleError(c.Req.Context(), http.StatusBadRequest, "UpdatePublicDashboard: no dashboardUid", dashboards.ErrDashboardIdentifierNotSet)
	}

	pubdash := &PublicDashboard{}
	if err := web.Bind(c.Req, pubdash); err != nil {
		return response.Error(http.StatusBadRequest, "UpdatePublicDashboard: bad request data", err)
	}

	if pubdash.Uid == "" {
		return response.Error(http.StatusBadRequest, "UpdatePublicDashboard: missing public dashboard uid", ErrPublicDashboardIdentifierNotSet)
	}

	// Always set the orgID and userID from the session
	pubdash.OrgId = c.OrgID
	dto := SavePublicDashboardDTO{
		UserId:          c.UserID,
		OrgId:           c.OrgID,
		DashboardUid:    dashboardUid,
		PublicDashboard: pubdash,
	}

	// Save the public dashboard
	pubdash, err := api.PublicDashboardService.Save(c.Req.Context(), c.SignedInUser, &dto)
	if err != nil {
		return api.handleError(c.Req.Context(), http.StatusInternalServerError, "UpdatePublicDashboard: failed to save public dashboard", err)
	}

	return response.JSON(http.StatusOK, pubdash)
}

// Delete a public dashboard
// DELETE /api/dashboards/uid/:dashboardUid/public-dashboards/:uid
func (api *Api) DeletePublicDashboard(c *models.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	if uid == "" || !util.IsValidShortUID(uid) {
		return api.handleError(c.Req.Context(), http.StatusBadRequest, "DeletePublicDashboard: invalid dashboard uid", dashboards.ErrDashboardIdentifierNotSet)
	}

	err := api.PublicDashboardService.Delete(c.Req.Context(), c.OrgID, uid)
	if err != nil {
		return api.handleError(c.Req.Context(), http.StatusInternalServerError, "DeletePublicDashboard: failed to delete public dashboard", err)
	}

	return response.JSON(http.StatusOK, nil)
}

// util to help us unpack dashboard and publicdashboard errors or use default http code and message
// we should look to do some future refactoring of these errors as publicdashboard err is the same as a dashboarderr, just defined in a
// different package.
func (api *Api) handleError(ctx context.Context, code int, message string, err error) response.Response {
	var publicDashboardErr PublicDashboardErr
	ctxLogger := api.Log.FromContext(ctx)
	ctxLogger.Error(message, "error", err.Error())

	// handle public dashboard error
	if ok := errors.As(err, &publicDashboardErr); ok {
		return response.Error(publicDashboardErr.StatusCode, publicDashboardErr.Error(), publicDashboardErr)
	}

	// handle dashboard errors as well
	var dashboardErr dashboards.DashboardErr
	if ok := errors.As(err, &dashboardErr); ok {
		return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), dashboardErr)
	}

	return response.Error(code, message, err)
}

// Copied from pkg/api/metrics.go
func toJsonStreamingResponse(features *featuremgmt.FeatureManager, qdr *backend.QueryDataResponse) response.Response {
	statusWhenError := http.StatusBadRequest
	if features.IsEnabled(featuremgmt.FlagDatasourceQueryMultiStatus) {
		statusWhenError = http.StatusMultiStatus
	}

	statusCode := http.StatusOK
	for _, res := range qdr.Responses {
		if res.Error != nil {
			statusCode = statusWhenError
		}
	}

	return response.JSONStreaming(statusCode, qdr)
}
