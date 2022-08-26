package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /user/stars signed_in_user starDashboard
//
// List dashboard stars.
//
// Returns a list of dashboards starred by the user.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetStars(c *models.ReqContext) response.Response {
	query := star.GetUserStarsQuery{
		UserID: c.SignedInUser.UserID,
		OrgID:  c.OrgID,
	}

	iuserstars, err := hs.starService.GetByUser(c.Req.Context(), &query)
	if err != nil {
		return response.Error(500, "Failed to get user stars", err)
	}

	return response.JSON(200, iuserstars.DashboardUIDs)
}

// swagger:route POST /user/stars/dashboard/{dashboard_id} signed_in_user listStarredDashboards
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
func (hs *HTTPServer) StarDashboard(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cmd := star.StarDashboardCommand{UserID: c.UserID, DashboardID: id}

	if cmd.DashboardID <= 0 {
		return response.Error(400, "Missing dashboard id", nil)
	}

	if err := hs.starService.Add(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to star dashboard", err)
	}

	return response.Success("Dashboard starred!")
}

// swagger:route POST /user/stars/dashboard/uid/{dashboard_id} signed_in_user starDashboardUID
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
func (hs *HTTPServer) StarDashboardUID(c *models.ReqContext) response.Response {
	uid, exists := web.Params(c.Req)[":uid"]
	if !exists {
		return response.Error(400, "Missing dashboard id", nil)
	}

	cmd := star.StarDashboardCommand{UserID: c.UserID, DashboardUID: uid}
	if err := hs.starService.Add(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to star dashboard", err)
	}

	return response.Success("Dashboard starred!")
}

// swagger:route DELETE /user/stars/dashboard/{dashboard_id} signed_in_user unstarDashboard
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
func (hs *HTTPServer) UnstarDashboard(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cmd := star.UnstarDashboardCommand{UserID: c.UserID, DashboardID: id}

	if cmd.DashboardID <= 0 {
		return response.Error(400, "Missing dashboard id", nil)
	}

	if err := hs.starService.Delete(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to unstar dashboard", err)
	}

	return response.Success("Dashboard unstarred")
}

// swagger:route DELETE /user/stars/dashboard/uid/{dashboard_id} signed_in_user unstarDashboardUID
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
func (hs *HTTPServer) UnstarDashboardUID(c *models.ReqContext) response.Response {
	uid, ok := web.Params(c.Req)[":uid"]
	if !ok {
		return response.Error(400, "Missing dashboard id", nil)
	}

	cmd := star.UnstarDashboardCommand{UserID: c.UserID, DashboardUID: uid}
	if err := hs.starService.Delete(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to unstar dashboard", err)
	}

	return response.Success("Dashboard unstarred")
}

// swagger:parameters starDashboard
type StarDashboardParams struct {
	// in:path
	// required:true
	DashboardID string `json:"dashboard_id"`
}

// swagger:parameters unstarDashboard
type UnstarDashboardParams struct {
	// in:path
	// required:true
	DashboardID string `json:"dashboard_id"`
}

// swagger:parameters starDashboardUID
type StarDashboardUIDParams struct {
	// in:path
	// required:true
	DashboardUID string `json:"dashboard_uid"`
}

// swagger:parameters unstarDashboardUID
type UnstarDashboardUIDParams struct {
	// in:path
	// required:true
	DashboardUID string `json:"dashboard_uid"`
}
