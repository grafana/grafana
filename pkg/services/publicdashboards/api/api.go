package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards/internal/tokens"
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
	auth := accesscontrol.Middleware(api.AccessControl)
	uidScope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(accesscontrol.Parameter(":uid"))

	// Anonymous access to public dashboard route is configured in pkg/api/api.go
	// because it is deeply dependent on the HTTPServer.Index() method and would result in a
	// circular dependency

	// public endpoints
	api.RouteRegister.Get("/api/public/dashboards/:accessToken", routing.Wrap(api.GetPublicDashboard))
	api.RouteRegister.Post("/api/public/dashboards/:accessToken/panels/:panelId/query", routing.Wrap(api.QueryPublicDashboard))
	api.RouteRegister.Get("/api/public/dashboards/:accessToken/annotations", routing.Wrap(api.GetAnnotations))

	// List Public Dashboards
	api.RouteRegister.Get("/api/dashboards/public", middleware.ReqSignedIn, routing.Wrap(api.ListPublicDashboards))
	// Delete Public dashboard
	api.RouteRegister.Delete("/api/dashboards/:uid/public/:publicDashboardUid",
		auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(dashboards.ActionDashboardsPublicWrite, uidScope)),
		routing.Wrap(api.DeletePublicDashboard))

	// Create/Update Public Dashboard
	api.RouteRegister.Get("/api/dashboards/uid/:uid/public-config",
		auth(middleware.ReqSignedIn, accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, uidScope)),
		routing.Wrap(api.GetPublicDashboardConfig))

	api.RouteRegister.Post("/api/dashboards/uid/:uid/public-config",
		auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(dashboards.ActionDashboardsPublicWrite, uidScope)),
		routing.Wrap(api.SavePublicDashboardConfig))
}

// GetPublicDashboard Gets public dashboard
// GET /api/public/dashboards/:accessToken
func (api *Api) GetPublicDashboard(c *models.ReqContext) response.Response {
	accessToken := web.Params(c.Req)[":accessToken"]

	if !tokens.IsValidAccessToken(accessToken) {
		return response.Error(http.StatusBadRequest, "Invalid Access Token", nil)
	}

	pubdash, dash, err := api.PublicDashboardService.FindPublicDashboardAndDashboardByAccessToken(
		c.Req.Context(),
		accessToken,
	)
	if err != nil {
		return api.handleError(c.Req.Context(), http.StatusInternalServerError, "GetPublicDashboard: failed to get public dashboard", err)
	}

	meta := dtos.DashboardMeta{
		Slug:                       dash.Slug,
		Type:                       models.DashTypeDB,
		CanStar:                    false,
		CanSave:                    false,
		CanEdit:                    false,
		CanAdmin:                   false,
		CanDelete:                  false,
		Created:                    dash.Created,
		Updated:                    dash.Updated,
		Version:                    dash.Version,
		IsFolder:                   false,
		FolderId:                   dash.FolderId,
		PublicDashboardAccessToken: pubdash.AccessToken,
		PublicDashboardUID:         pubdash.Uid,
	}

	dto := dtos.DashboardFullWithMeta{Meta: meta, Dashboard: dash.Data}

	return response.JSON(http.StatusOK, dto)
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

// Delete a public dashboard
// DELETE /api/dashboards/:uid/public/:publicDashboardUid
func (api *Api) DeletePublicDashboard(c *models.ReqContext) response.Response {
	err := api.PublicDashboardService.Delete(c.Req.Context(), c.SignedInUser.OrgID, web.Params(c.Req)[":uid"], web.Params(c.Req)[":publicDashboardUid"])
	if err != nil {
		var publicDashboardErr PublicDashboardErr
		if ok := errors.As(err, &publicDashboardErr); ok {
			return api.handleError(c.Req.Context(), publicDashboardErr.StatusCode, "DeletePublicDashboard: failed to delete public dashboard", err)
		}
		return api.handleError(c.Req.Context(), http.StatusInternalServerError, "DeletePublicDashboard: failed to delete public dashboard", err)
	}

	return response.JSON(http.StatusOK, nil)
}

// Gets public dashboard configuration for dashboard
// GetPublicDashboardConfig Gets public dashboard configuration for dashboard
// GET /api/dashboards/uid/:uid/public-config
func (api *Api) GetPublicDashboardConfig(c *models.ReqContext) response.Response {
	pdc, err := api.PublicDashboardService.FindByDashboardUid(c.Req.Context(), c.OrgID, web.Params(c.Req)[":uid"])
	if err != nil {
		return api.handleError(c.Req.Context(), http.StatusInternalServerError, "GetPublicDashboardConfig: failed to get public dashboard config", err)
	}
	return response.JSON(http.StatusOK, pdc)
}

// SavePublicDashboardConfig Sets public dashboard configuration for dashboard
// POST /api/dashboards/uid/:uid/public-config
func (api *Api) SavePublicDashboardConfig(c *models.ReqContext) response.Response {
	// exit if we don't have a valid dashboardUid
	dashboardUid := web.Params(c.Req)[":uid"]
	if dashboardUid == "" || !util.IsValidShortUID(dashboardUid) {
		api.handleError(c.Req.Context(), http.StatusBadRequest, "SavePublicDashboardConfig: no dashboardUid", dashboards.ErrDashboardIdentifierNotSet)
	}

	pubdash := &PublicDashboard{}
	if err := web.Bind(c.Req, pubdash); err != nil {
		return response.Error(http.StatusBadRequest, "SavePublicDashboardConfig: bad request data", err)
	}

	// Always set the orgID and userID from the session
	pubdash.OrgId = c.OrgID
	dto := SavePublicDashboardConfigDTO{
		UserId:          c.UserID,
		OrgId:           c.OrgID,
		DashboardUid:    dashboardUid,
		PublicDashboard: pubdash,
	}

	// Save the public dashboard
	pubdash, err := api.PublicDashboardService.Save(c.Req.Context(), c.SignedInUser, &dto)
	if err != nil {
		return api.handleError(c.Req.Context(), http.StatusInternalServerError, "SavePublicDashboardConfig: failed to save public dashboard configuration", err)
	}

	return response.JSON(http.StatusOK, pubdash)
}

// QueryPublicDashboard returns all results for a given panel on a public dashboard
// POST /api/public/dashboard/:accessToken/panels/:panelId/query
func (api *Api) QueryPublicDashboard(c *models.ReqContext) response.Response {
	accessToken := web.Params(c.Req)[":accessToken"]
	if !tokens.IsValidAccessToken(accessToken) {
		return response.Error(http.StatusBadRequest, "Invalid Access Token", nil)
	}

	panelId, err := strconv.ParseInt(web.Params(c.Req)[":panelId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "QueryPublicDashboard: invalid panel ID", err)
	}

	reqDTO := PublicDashboardQueryDTO{}
	if err = web.Bind(c.Req, &reqDTO); err != nil {
		return response.Error(http.StatusBadRequest, "QueryPublicDashboard: bad request data", err)
	}

	resp, err := api.PublicDashboardService.GetQueryDataResponse(c.Req.Context(), c.SkipCache, reqDTO, panelId, accessToken)
	if err != nil {
		return api.handleError(c.Req.Context(), http.StatusInternalServerError, "QueryPublicDashboard: error running public dashboard panel queries", err)
	}

	return toJsonStreamingResponse(api.Features, resp)
}

// GetAnnotations returns annotations for a public dashboard
// GET /api/public/dashboards/:accessToken/annotations
func (api *Api) GetAnnotations(c *models.ReqContext) response.Response {
	accessToken := web.Params(c.Req)[":accessToken"]
	if !tokens.IsValidAccessToken(accessToken) {
		return response.Error(http.StatusBadRequest, "Invalid Access Token", nil)
	}

	reqDTO := AnnotationsQueryDTO{
		From: c.QueryInt64("from"),
		To:   c.QueryInt64("to"),
	}

	annotations, err := api.PublicDashboardService.FindAnnotations(c.Req.Context(), reqDTO, accessToken)

	if err != nil {
		return api.handleError(c.Req.Context(), http.StatusInternalServerError, "error getting public dashboard annotations", err)
	}

	return response.JSON(http.StatusOK, annotations)
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
