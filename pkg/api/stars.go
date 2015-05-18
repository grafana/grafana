package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

func StarDashboard(c *middleware.Context) {
	if !c.IsSignedIn {
		c.JsonApiErr(412, "You need to sign in to star dashboards", nil)
		return
	}

	var cmd = m.StarDashboardCommand{
		UserId:      c.UserId,
		DashboardId: c.ParamsInt64(":id"),
	}

	if cmd.DashboardId <= 0 {
		c.JsonApiErr(400, "Missing dashboard id", nil)
		return
	}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to star dashboard", err)
		return
	}

	c.JsonOK("Dashboard starred!")
}

func UnstarDashboard(c *middleware.Context) {
	var cmd = m.UnstarDashboardCommand{
		UserId:      c.UserId,
		DashboardId: c.ParamsInt64(":id"),
	}

	if cmd.DashboardId <= 0 {
		c.JsonApiErr(400, "Missing dashboard id", nil)
		return
	}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to unstar dashboard", err)
		return
	}

	c.JsonOK("Dashboard unstarred")
}
