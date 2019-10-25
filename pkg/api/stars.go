package api

import (
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func StarDashboard(c *m.ReqContext) Response {
	if !c.IsSignedIn {
		return Error(412, "You need to sign in to star dashboards", nil)
	}

	cmd := m.StarDashboardCommand{UserId: c.UserId, DashboardId: c.ParamsInt64(":id")}

	if cmd.DashboardId <= 0 {
		return Error(400, "Missing dashboard id", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to star dashboard", err)
	}

	return Success("Dashboard starred!")
}

func UnstarDashboard(c *m.ReqContext) Response {

	cmd := m.UnstarDashboardCommand{UserId: c.UserId, DashboardId: c.ParamsInt64(":id")}

	if cmd.DashboardId <= 0 {
		return Error(400, "Missing dashboard id", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to unstar dashboard", err)
	}

	return Success("Dashboard unstarred")
}
