package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetStars(c *models.ReqContext) response.Response {
	query := models.GetUserStarsQuery{
		UserId: c.SignedInUser.UserId,
	}

	err := hs.SQLStore.GetUserStars(c.Req.Context(), &query)
	if err != nil {
		return response.Error(500, "Failed to get user stars", err)
	}

	iuserstars := query.Result
	uids := []string{}
	for dashboardId := range iuserstars {
		query := &models.GetDashboardQuery{
			Id:    dashboardId,
			OrgId: c.OrgId,
		}
		err := hs.dashboardService.GetDashboard(c.Req.Context(), query)
		if err != nil {
			return response.Error(500, "Failed to get dashboard", err)
		}
		uids = append(uids, query.Result.Uid)
	}
	return response.JSON(200, uids)
}

func (hs *HTTPServer) StarDashboard(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cmd := models.StarDashboardCommand{UserId: c.UserId, DashboardId: id}

	if cmd.DashboardId <= 0 {
		return response.Error(400, "Missing dashboard id", nil)
	}

	if err := hs.SQLStore.StarDashboard(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to star dashboard", err)
	}

	return response.Success("Dashboard starred!")
}

func (hs *HTTPServer) UnstarDashboard(c *models.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	cmd := models.UnstarDashboardCommand{UserId: c.UserId, DashboardId: id}

	if cmd.DashboardId <= 0 {
		return response.Error(400, "Missing dashboard id", nil)
	}

	if err := hs.SQLStore.UnstarDashboard(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to unstar dashboard", err)
	}

	return response.Success("Dashboard unstarred")
}
