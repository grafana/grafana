package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func StarDashboard(c *models.ReqContext) response.Response {
	cmd := models.StarDashboardCommand{UserId: c.UserId, DashboardId: c.ParamsInt64(":id")}

	if cmd.DashboardId <= 0 {
		return response.Error(400, "Missing dashboard id", nil)
	}

	if err := bus.Dispatch(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to star dashboard", err)
	}

	return response.Success("Dashboard starred!")
}

func UnstarDashboard(c *models.ReqContext) response.Response {
	cmd := models.UnstarDashboardCommand{UserId: c.UserId, DashboardId: c.ParamsInt64(":id")}

	if cmd.DashboardId <= 0 {
		return response.Error(400, "Missing dashboard id", nil)
	}

	if err := bus.Dispatch(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to unstar dashboard", err)
	}

	return response.Success("Dashboard unstarred")
}
