package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetStars(c *models.ReqContext) response.Response {
	// SELECT uid FROM star JOIN dashboard ON star.dashboard_id = dashboard.id
	// WHERE star.user_id = 1
	type row struct {
		Uid string
	}
	rows := make([]*row, 0, 1000)

	err := hs.SQLStore.WithDbSession(c.Req.Context(), func(sess *sqlstore.DBSession) error {
		sess.Table("star").
			Join("INNER", "dashboard", "star.dashboard_id = dashboard.id").
			Where("user_id = ?", c.UserId)
		sess.Cols("uid")
		return sess.Find(&rows)
	})
	if err != nil {
		return response.Error(500, "error finding stars", err)
	}

	// Add all UIDs to star response
	uids := []string{}
	for _, row := range rows {
		uids = append(uids, row.Uid)
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
