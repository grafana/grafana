package api

import (
	"context"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/web"
)

type API struct {
	starService      star.Service
	dashboardService dashboards.DashboardService
}

func ProvideApi(
	starService star.Service,
	dashboardService dashboards.DashboardService,
) *API {
	api := &API{
		starService:      starService,
		dashboardService: dashboardService,
	}
	return api
}

func (api *API) getDashboardHelper(ctx context.Context, orgID int64, id int64, uid string) (*dashboards.Dashboard, response.Response) {
	var query dashboards.GetDashboardQuery

	if len(uid) > 0 {
		query = dashboards.GetDashboardQuery{UID: uid, ID: id, OrgID: orgID}
	} else {
		query = dashboards.GetDashboardQuery{ID: id, OrgID: orgID}
	}

	result, err := api.dashboardService.GetDashboard(ctx, &query)
	if err != nil {
		return nil, response.Error(http.StatusNotFound, "Dashboard not found", err)
	}

	return result, nil
}

func (api *API) GetStars(c *contextmodel.ReqContext) response.Response {
	namespace, identifier := c.SignedInUser.GetNamespacedID()
	if namespace != identity.NamespaceUser && namespace != identity.NamespaceServiceAccount {
		return response.Error(http.StatusBadRequest, "Only users and service accounts can star dashboards", nil)
	}

	userID, err := identity.IntIdentifier(namespace, identifier)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Invalid user ID", err)
	}

	query := star.GetUserStarsQuery{
		UserID: userID,
	}

	iuserstars, err := api.starService.GetByUser(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get user stars", err)
	}

	uids := []string{}
	if len(iuserstars.UserStars) > 0 {
		var ids []int64
		for id := range iuserstars.UserStars {
			ids = append(ids, id)
		}
		starredDashboards, err := api.dashboardService.GetDashboards(c.Req.Context(), &dashboards.GetDashboardsQuery{DashboardIDs: ids, OrgID: c.SignedInUser.GetOrgID()})
		if err != nil {
			return response.ErrOrFallback(http.StatusInternalServerError, "Failed to fetch dashboards", err)
		}

		uids = make([]string, len(starredDashboards))
		for i, dash := range starredDashboards {
			uids[i] = dash.UID
		}
	}

	return response.JSON(http.StatusOK, uids)
}

// swagger:route POST /user/stars/dashboard/{dashboard_id} signed_in_user starDashboard
//
// Star a dashboard.
//
// Stars the given Dashboard for the actual user.
//
// Deprecated: true
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *API) StarDashboard(c *contextmodel.ReqContext) response.Response {
	namespace, identifier := c.SignedInUser.GetNamespacedID()
	if namespace != identity.NamespaceUser && namespace != identity.NamespaceServiceAccount {
		return response.Error(http.StatusBadRequest, "Only users and service accounts can star dashboards", nil)
	}

	userID, err := identity.IntIdentifier(namespace, identifier)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Invalid user ID", err)
	}
	idString := web.Params(c.Req)[":id"]
	id, err := strconv.ParseInt(idString, 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Invalid dashboard ID", nil)
	}

	cmd := star.StarDashboardCommand{UserID: userID, DashboardID: id}
	if cmd.DashboardID <= 0 {
		return response.Error(http.StatusBadRequest, "Missing dashboard id", nil)
	}

	if err := api.starService.Add(c.Req.Context(), &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to star dashboard", err)
	}

	return response.Success("Dashboard starred!")
}

// swagger:route POST /user/stars/dashboard/uid/{dashboard_uid} signed_in_user starDashboardByUID
//
// Star a dashboard.
//
// Stars the given Dashboard for the actual user.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *API) StarDashboardByUID(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	if uid == "" {
		return response.Error(http.StatusBadRequest, "Invalid dashboard UID", nil)
	}

	namespace, identifier := c.SignedInUser.GetNamespacedID()
	if namespace != identity.NamespaceUser && namespace != identity.NamespaceServiceAccount {
		return response.Error(http.StatusBadRequest, "Only users and service accounts can star dashboards", nil)
	}

	userID, err := identity.IntIdentifier(namespace, identifier)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Invalid user ID", err)
	}

	dash, rsp := api.getDashboardHelper(c.Req.Context(), c.SignedInUser.GetOrgID(), 0, uid)

	if rsp != nil {
		return rsp
	}

	cmd := star.StarDashboardCommand{UserID: userID, DashboardID: dash.ID}

	if err := api.starService.Add(c.Req.Context(), &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to star dashboard", err)
	}

	return response.Success("Dashboard starred!")
}

// swagger:route DELETE /user/stars/dashboard/{dashboard_id} signed_in_user unstarDashboard
//
// Unstar a dashboard.
//
// Deletes the starring of the given Dashboard for the actual user.
//
// Deprecated: true
//
// Please refer to the [new](#/signed_in_user/unstarDashboardByUID) API instead
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *API) UnstarDashboard(c *contextmodel.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Invalid dashboard ID", nil)
	}

	namespace, identifier := c.SignedInUser.GetNamespacedID()
	if namespace != identity.NamespaceUser && namespace != identity.NamespaceServiceAccount {
		return response.Error(http.StatusBadRequest, "Only users and service accounts can star dashboards", nil)
	}

	userID, err := identity.IntIdentifier(namespace, identifier)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Invalid user ID", err)
	}

	cmd := star.UnstarDashboardCommand{UserID: userID, DashboardID: id}
	if cmd.DashboardID <= 0 {
		return response.Error(http.StatusBadRequest, "Missing dashboard id", nil)
	}

	if err := api.starService.Delete(c.Req.Context(), &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to unstar dashboard", err)
	}

	return response.Success("Dashboard unstarred")
}

// swagger:route DELETE /user/stars/dashboard/uid/{dashboard_uid} signed_in_user unstarDashboardByUID
//
// Unstar a dashboard.
//
// Deletes the starring of the given Dashboard for the actual user.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *API) UnstarDashboardByUID(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	if uid == "" {
		return response.Error(http.StatusBadRequest, "Invalid dashboard UID", nil)
	}

	namespace, identifier := c.SignedInUser.GetNamespacedID()
	if namespace != identity.NamespaceUser && namespace != identity.NamespaceServiceAccount {
		return response.Error(http.StatusBadRequest, "Only users and service accounts can star dashboards", nil)
	}

	userID, err := identity.IntIdentifier(namespace, identifier)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Invalid user ID", err)
	}

	dash, rsp := api.getDashboardHelper(c.Req.Context(), c.SignedInUser.GetOrgID(), 0, uid)
	if rsp != nil {
		return rsp
	}

	cmd := star.UnstarDashboardCommand{UserID: userID, DashboardID: dash.ID}

	if err := api.starService.Delete(c.Req.Context(), &cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to unstar dashboard", err)
	}

	return response.Success("Dashboard unstarred")
}

// swagger:parameters starDashboard
type StarDashboardParams struct {
	// in:path
	// required:true
	DashboardID string `json:"dashboard_id"`
}

// swagger:parameters starDashboardByUID
type StarDashboardByUIDParams struct {
	// in:path
	// required:true
	DashboardUID string `json:"dashboard_uid"`
}

// swagger:parameters unstarDashboard
type UnstarDashboardParams struct {
	// in:path
	// required:true
	DashboardID string `json:"dashboard_id"`
}

// swagger:parameters unstarDashboardByUID
type UnstarDashboardByUIDParams struct {
	// in:path
	// required:true
	DashboardUID string `json:"dashboard_uid"`
}
