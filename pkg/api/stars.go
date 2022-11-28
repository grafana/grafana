package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/star"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetStars(c *models.ReqContext) response.Response {
	query := star.GetUserStarsQuery{
		UserID: c.SignedInUser.UserID,
	}

	iuserstars, err := hs.starService.GetByUser(c.Req.Context(), &query)
	if err != nil {
		return response.Error(500, "Failed to get user stars", err)
	}

	uids := []string{}
	for dashboardId := range iuserstars.UserStars {
		query := &models.GetDashboardQuery{
			Id:    dashboardId,
			OrgId: c.OrgID,
		}
		err := hs.DashboardService.GetDashboard(c.Req.Context(), query)

		// Grafana admin users may have starred dashboards in multiple orgs.  This will avoid returning errors when the dashboard is in another org
		if err == nil {
			uids = append(uids, query.Result.Uid)
		}
	}
	return response.JSON(200, uids)
}

// swagger:route POST /user/stars/dashboard/{dashboard_id} signed_in_user starDashboard
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
