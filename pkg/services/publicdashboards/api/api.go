package api

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	. "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type Api struct {
	PublicDashboardService publicdashboards.Service
	Middleware             publicdashboards.Middleware

	accessControl accesscontrol.AccessControl
	cfg           *setting.Cfg
	features      featuremgmt.FeatureToggles
	license       licensing.Licensing
	log           log.Logger
	routeRegister routing.RouteRegister
}

func ProvideApi(
	pd publicdashboards.Service,
	rr routing.RouteRegister,
	ac accesscontrol.AccessControl,
	features featuremgmt.FeatureToggles,
	md publicdashboards.Middleware,
	cfg *setting.Cfg,
	license licensing.Licensing,
) *Api {
	api := &Api{
		PublicDashboardService: pd,
		Middleware:             md,
		accessControl:          ac,
		cfg:                    cfg,
		features:               features,
		license:                license,
		log:                    log.New("publicdashboards.api"),
		routeRegister:          rr,
	}

	// register endpoints if the feature is enabled
	if cfg.PublicDashboardsEnabled {
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
	api.routeRegister.Group("/api/public/dashboards/:accessToken", func(apiRoute routing.RouteRegister) {
		apiRoute.Get("/", routing.Wrap(api.ViewPublicDashboard))
		apiRoute.Get("/annotations", routing.Wrap(api.GetPublicAnnotations))
		apiRoute.Post("/panels/:panelId/query", routing.Wrap(api.QueryPublicDashboard))
	}, api.Middleware.HandleApi)

	// Auth endpoints
	auth := accesscontrol.Middleware(api.accessControl)
	uidScope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(accesscontrol.Parameter(":dashboardUid"))

	// List public dashboards for org
	api.routeRegister.Get("/api/dashboards/public-dashboards", middleware.ReqSignedIn, routing.Wrap(api.ListPublicDashboards))
	// Get public dashboard
	api.routeRegister.Get("/api/dashboards/uid/:dashboardUid/public-dashboards",
		auth(accesscontrol.EvalPermission(dashboards.ActionDashboardsRead, uidScope)),
		routing.Wrap(api.GetPublicDashboard))

	// Create Public Dashboard
	api.routeRegister.Post("/api/dashboards/uid/:dashboardUid/public-dashboards",
		auth(accesscontrol.EvalPermission(dashboards.ActionDashboardsPublicWrite, uidScope)),
		routing.Wrap(api.CreatePublicDashboard))

	// Update Public Dashboard
	api.routeRegister.Patch("/api/dashboards/uid/:dashboardUid/public-dashboards/:uid",
		auth(accesscontrol.EvalPermission(dashboards.ActionDashboardsPublicWrite, uidScope)),
		routing.Wrap(api.UpdatePublicDashboard))

	// Delete Public dashboard
	api.routeRegister.Delete("/api/dashboards/uid/:dashboardUid/public-dashboards/:uid",
		auth(accesscontrol.EvalPermission(dashboards.ActionDashboardsPublicWrite, uidScope)),
		routing.Wrap(api.DeletePublicDashboard))
}

// swagger:route GET /dashboards/public-dashboards dashboard_public listPublicDashboards
//
//	Get list of public dashboards
//
// Responses:
// 200: listPublicDashboardsResponse
// 401: unauthorisedPublicError
// 403: forbiddenPublicError
// 500: internalServerPublicError
func (api *Api) ListPublicDashboards(c *contextmodel.ReqContext) response.Response {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}

	page := c.QueryInt("page")
	if page < 1 {
		page = 1
	}

	resp, err := api.PublicDashboardService.FindAllWithPagination(c.Req.Context(), &PublicDashboardListQuery{
		OrgID: c.GetOrgID(),
		Query: c.Query("query"),
		Page:  page,
		Limit: perPage,
		User:  c.SignedInUser,
	})

	if err != nil {
		return response.Err(err)
	}
	return response.JSON(http.StatusOK, resp)
}

// swagger:route GET /dashboards/uid/{dashboardUid}/public-dashboards dashboard_public getPublicDashboard
//
//	Get public dashboard by dashboardUid
//
// Responses:
// 200: getPublicDashboardResponse
// 400: badRequestPublicError
// 401: unauthorisedPublicError
// 403: forbiddenPublicError
// 404: notFoundPublicError
// 500: internalServerPublicError
func (api *Api) GetPublicDashboard(c *contextmodel.ReqContext) response.Response {
	// exit if we don't have a valid dashboardUid
	dashboardUid := web.Params(c.Req)[":dashboardUid"]
	if !validation.IsValidShortUID(dashboardUid) {
		return response.Err(ErrPublicDashboardIdentifierNotSet.Errorf("GetPublicDashboard: no dashboard Uid for public dashboard specified"))
	}

	pd, err := api.PublicDashboardService.FindByDashboardUid(c.Req.Context(), c.GetOrgID(), dashboardUid)
	if err != nil {
		return response.Err(err)
	}

	if pd == nil || (!api.license.FeatureEnabled(FeaturePublicDashboardsEmailSharing) && pd.Share == EmailShareType) {
		return response.Err(ErrPublicDashboardNotFound.Errorf("GetPublicDashboard: public dashboard not found"))
	}

	return response.JSON(http.StatusOK, pd)
}

// swagger:route POST /dashboards/uid/{dashboardUid}/public-dashboards dashboard_public createPublicDashboard
//
//	Create public dashboard for a dashboard
//
// Produces:
// - application/json
//
// Responses:
// 200: createPublicDashboardResponse
// 400: badRequestPublicError
// 401: unauthorisedPublicError
// 403: forbiddenPublicError
// 500: internalServerPublicError
func (api *Api) CreatePublicDashboard(c *contextmodel.ReqContext) response.Response {
	// exit if we don't have a valid dashboardUid
	dashboardUid := web.Params(c.Req)[":dashboardUid"]
	if !validation.IsValidShortUID(dashboardUid) {
		return response.Err(ErrInvalidUid.Errorf("CreatePublicDashboard: invalid Uid %s", dashboardUid))
	}

	pdDTO := &PublicDashboardDTO{}
	if err := web.Bind(c.Req, pdDTO); err != nil {
		return response.Err(ErrBadRequest.Errorf("CreatePublicDashboard: bad request data %v", err))
	}

	//validate uid
	uid := pdDTO.Uid
	if uid != "" && !validation.IsValidShortUID(uid) {
		return response.Err(ErrInvalidUid.Errorf("CreatePublicDashboard: invalid Uid %s", uid))
	}

	//validate accessToken
	accessToken := pdDTO.AccessToken
	if accessToken != "" && !validation.IsValidAccessToken(accessToken) {
		return response.Err(ErrInvalidAccessToken.Errorf("CreatePublicDashboard: invalid Access Token %s", accessToken))
	}

	// Always set the orgID and userID from the session
	dto := &SavePublicDashboardDTO{
		UserId:          c.UserID,
		OrgID:           c.GetOrgID(),
		DashboardUid:    dashboardUid,
		PublicDashboard: pdDTO,
	}

	//Create the public dashboard
	pd, err := api.PublicDashboardService.Create(c.Req.Context(), c.SignedInUser, dto)
	if err != nil {
		return response.Err(err)
	}

	return response.JSON(http.StatusOK, pd)
}

// swagger:route PATCH /dashboards/uid/{dashboardUid}/public-dashboards/{uid} dashboard_public updatePublicDashboard
//
//	Update public dashboard for a dashboard
//
// Produces:
// - application/json
//
// Responses:
// 200: updatePublicDashboardResponse
// 400: badRequestPublicError
// 401: unauthorisedPublicError
// 403: forbiddenPublicError
// 500: internalServerPublicError
func (api *Api) UpdatePublicDashboard(c *contextmodel.ReqContext) response.Response {
	// exit if we don't have a valid dashboardUid
	dashboardUid := web.Params(c.Req)[":dashboardUid"]
	if !validation.IsValidShortUID(dashboardUid) {
		return response.Err(ErrInvalidUid.Errorf("UpdatePublicDashboard: invalid dashboard Uid %s", dashboardUid))
	}

	uid := web.Params(c.Req)[":uid"]
	if !validation.IsValidShortUID(uid) {
		return response.Err(ErrInvalidUid.Errorf("UpdatePublicDashboard: invalid Uid %s", uid))
	}

	pdDTO := &PublicDashboardDTO{}
	if err := web.Bind(c.Req, pdDTO); err != nil {
		return response.Err(ErrBadRequest.Errorf("UpdatePublicDashboard: bad request data %v", err))
	}

	// Always set the orgID and userID from the session
	dto := SavePublicDashboardDTO{
		Uid:             uid,
		UserId:          c.UserID,
		OrgID:           c.GetOrgID(),
		DashboardUid:    dashboardUid,
		PublicDashboard: pdDTO,
	}

	// Update the public dashboard
	pd, err := api.PublicDashboardService.Update(c.Req.Context(), c.SignedInUser, &dto)
	if err != nil {
		return response.Err(err)
	}

	return response.JSON(http.StatusOK, pd)
}

// swagger:route DELETE /dashboards/uid/{dashboardUid}/public-dashboards/{uid} dashboard_public deletePublicDashboard
//
//	Delete public dashboard for a dashboard
//
// Responses:
// 200: okResponse
// 400: badRequestPublicError
// 401: unauthorisedPublicError
// 403: forbiddenPublicError
// 500: internalServerPublicError
func (api *Api) DeletePublicDashboard(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	if !validation.IsValidShortUID(uid) {
		return response.Err(ErrInvalidUid.Errorf("DeletePublicDashboard: invalid Uid %s", uid))
	}

	dashboardUid := web.Params(c.Req)[":dashboardUid"]
	if !validation.IsValidShortUID(dashboardUid) {
		return response.Err(ErrInvalidUid.Errorf("DeletePublicDashboard: invalid dashboard Uid %s", dashboardUid))
	}

	err := api.PublicDashboardService.Delete(c.Req.Context(), uid, dashboardUid)
	if err != nil {
		return response.Err(err)
	}

	return response.Empty(http.StatusOK)
}

// Copied from pkg/api/metrics.go
func toJsonStreamingResponse(ctx context.Context, features featuremgmt.FeatureToggles, qdr *backend.QueryDataResponse) response.Response {
	statusCode := http.StatusOK
	for _, res := range qdr.Responses {
		if res.Error != nil {
			statusCode = http.StatusBadRequest
			break
		}
	}

	return response.JSONStreaming(statusCode, qdr)
}

// swagger:response listPublicDashboardsResponse
type ListPublicDashboardsResponse struct {
	// in: body
	Body PublicDashboardListResponseWithPagination `json:"body"`
}

// swagger:parameters getPublicDashboard
type GetPublicDashboardParams struct {
	// in:path
	DashboardUid string `json:"dashboardUid"`
}

// swagger:response getPublicDashboardResponse
type GetPublicDashboardResponse struct {
	// in: body
	Body PublicDashboard `json:"body"`
}

// swagger:parameters createPublicDashboard
type CreatePublicDashboardParams struct {
	// in:path
	// required:true
	DashboardUid string `json:"dashboardUid"`
	// in:body
	// required:true
	Body PublicDashboardDTO
}

// swagger:response createPublicDashboardResponse
type CreatePublicDashboardResponse struct {
	// in: body
	Body PublicDashboard `json:"body"`
}

// swagger:parameters updatePublicDashboard
type UpdatePublicDashboardParams struct {
	// in:path
	// required:true
	DashboardUid string `json:"dashboardUid"`
	// in:path
	// required:true
	Uid string `json:"uid"`
	// in:body
	// required:true
	Body PublicDashboardDTO
}

// swagger:response updatePublicDashboardResponse
type UpdatePublicDashboardResponse struct {
	// in: body
	Body PublicDashboard `json:"body"`
}

// swagger:parameters deletePublicDashboard
type DeletePublicDashboardParams struct {
	// in:path
	// required:true
	DashboardUid string `json:"dashboardUid"`
	// in:path
	// required:true
	Uid string `json:"uid"`
}
