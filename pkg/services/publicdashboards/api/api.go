package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
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
	}

	// attach api if PublicDashboards feature flag is enabled
	if features.IsEnabled(featuremgmt.FlagPublicDashboards) {
		api.RegisterAPIEndpoints()
	}

	return api
}

//Registers Endpoints on Grafana Router
func (api *Api) RegisterAPIEndpoints() {
	auth := accesscontrol.Middleware(api.AccessControl)

	// Anonymous access to public dashboard route is configured in pkg/api/api.go
	// because it is deeply dependent on the HTTPServer.Index() method and would result in a
	// circular dependency

	// public endpoints
	api.RouteRegister.Get("/api/public/dashboards/:accessToken", routing.Wrap(api.GetPublicDashboard))
	api.RouteRegister.Post("/api/public/dashboards/:accessToken/panels/:panelId/query", routing.Wrap(api.QueryPublicDashboard))

	// Create/Update Public Dashboard
	uidScope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(accesscontrol.Parameter(":uid"))

	api.RouteRegister.Get("/api/dashboards/uid/:uid/public-config",
		auth(middleware.ReqSignedIn, accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, uidScope)),
		routing.Wrap(api.GetPublicDashboardConfig))

	api.RouteRegister.Post("/api/dashboards/uid/:uid/public-config",
		auth(middleware.ReqOrgAdmin, accesscontrol.EvalPermission(dashboards.ActionDashboardPublicWrite, uidScope)),
		routing.Wrap(api.SavePublicDashboardConfig))
}

// Gets public dashboard
// GET /api/public/dashboards/:accessToken
func (api *Api) GetPublicDashboard(c *models.ReqContext) response.Response {
	accessToken := web.Params(c.Req)[":accessToken"]

	pubdash, dash, err := api.PublicDashboardService.GetPublicDashboard(
		c.Req.Context(),
		accessToken,
	)

	if err != nil {
		return handleDashboardErr(http.StatusInternalServerError, "Failed to get public dashboard", err)
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

// Gets public dashboard configuration for dashboard
// GET /api/dashboards/uid/:uid/public-config
func (api *Api) GetPublicDashboardConfig(c *models.ReqContext) response.Response {
	pdc, err := api.PublicDashboardService.GetPublicDashboardConfig(c.Req.Context(), c.OrgID, web.Params(c.Req)[":uid"])
	if err != nil {
		return handleDashboardErr(http.StatusInternalServerError, "Failed to get public dashboard config", err)
	}
	return response.JSON(http.StatusOK, pdc)
}

// Sets public dashboard configuration for dashboard
// POST /api/dashboards/uid/:uid/public-config
func (api *Api) SavePublicDashboardConfig(c *models.ReqContext) response.Response {
	// exit if we don't have a valid dashboardUid
	dashboardUid := web.Params(c.Req)[":uid"]
	if dashboardUid == "" || !util.IsValidShortUID(dashboardUid) {
		handleDashboardErr(http.StatusBadRequest, "no dashboardUid", dashboards.ErrDashboardIdentifierNotSet)
	}

	pubdash := &PublicDashboard{}
	if err := web.Bind(c.Req, pubdash); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
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
	pubdash, err := api.PublicDashboardService.SavePublicDashboardConfig(c.Req.Context(), c.SignedInUser, &dto)
	if err != nil {
		return handleDashboardErr(http.StatusInternalServerError, "Failed to save public dashboard configuration", err)
	}

	return response.JSON(http.StatusOK, pubdash)
}

// QueryPublicDashboard returns all results for a given panel on a public dashboard
// POST /api/public/dashboard/:accessToken/panels/:panelId/query
func (api *Api) QueryPublicDashboard(c *models.ReqContext) response.Response {
	panelId, err := strconv.ParseInt(web.Params(c.Req)[":panelId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "invalid panel ID", err)
	}

	reqDTO := &PublicDashboardQueryDTO{}
	if err = web.Bind(c.Req, reqDTO); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	resp, err := api.PublicDashboardService.GetQueryDataResponse(c.Req.Context(), c.SkipCache, reqDTO, panelId, web.Params(c.Req)[":accessToken"])
	if err != nil {
		return handlePublicDashboardErr(err)
	}

	return toJsonStreamingResponse(api.Features, resp)
}

// util to help us unpack dashboard and publicdashboard errors or use default http code and message
// we should look to do some future refactoring of these errors as publicdashboard err is the same as a dashboarderr, just defined in a
// different package.
func handleDashboardErr(defaultCode int, defaultMsg string, err error) response.Response {
	var publicDashboardErr PublicDashboardErr

	// handle public dashboard er
	if ok := errors.As(err, &publicDashboardErr); ok {
		return response.Error(publicDashboardErr.StatusCode, publicDashboardErr.Error(), publicDashboardErr)
	}

	// handle dashboard errors as well
	var dashboardErr dashboards.DashboardErr
	if ok := errors.As(err, &dashboardErr); ok {
		return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), dashboardErr)
	}

	return response.Error(defaultCode, defaultMsg, err)
}

func handlePublicDashboardErr(err error) response.Response {
	return handleDashboardErr(http.StatusInternalServerError, "Unexpected Error", err)
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
