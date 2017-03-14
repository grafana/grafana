package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func StarDashboard(c *middleware.Context) Response {
	if !c.IsSignedIn {
		return ApiError(412, "You need to sign in to star dashboards", nil)
	}

	cmd := m.StarDashboardCommand{UserId: c.UserId, DashboardId: c.ParamsInt64(":id")}

	if cmd.DashboardId <= 0 {
		return ApiError(400, "Missing dashboard id", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to star dashboard", err)
	}

	return ApiSuccess("Dashboard starred!")
}

func UnstarDashboard(c *middleware.Context) Response {

	cmd := m.UnstarDashboardCommand{UserId: c.UserId, DashboardId: c.ParamsInt64(":id")}

	if cmd.DashboardId <= 0 {
		return ApiError(400, "Missing dashboard id", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to unstar dashboard", err)
	}

	return ApiSuccess("Dashboard unstarred")
}
