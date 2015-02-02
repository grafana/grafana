package api

import (
	"strconv"

	"github.com/torkelo/grafana-pro/pkg/api/dtos"
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func StarDashboard(c *middleware.Context) {
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

func GetUserStars(c *middleware.Context) {
	query := m.GetUserStarsQuery{UserId: c.UserId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to get user stars", err)
		return
	}

	var result dtos.UserStars
	result.DashboardIds = make(map[string]bool)
	for _, star := range query.Result {
		result.DashboardIds[strconv.FormatInt(star.DashboardId, 10)] = true
	}

	c.JSON(200, &result)
}
