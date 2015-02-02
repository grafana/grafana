package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func AddAsFavorite(c *middleware.Context) {
	var cmd = m.AddAsFavoriteCommand{
		UserId:      c.UserId,
		DashboardId: c.ParamsInt64(":id"),
	}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add favorite", err)
		return
	}

	c.JsonOK("Dashboard marked as favorite")
}

func RemoveAsFavorite(c *middleware.Context) {
	var cmd = m.RemoveAsFavoriteCommand{
		UserId:      c.UserId,
		DashboardId: c.ParamsInt64(":id"),
	}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to remove favorite", err)
		return
	}

	c.JsonOK("Favorite removed")
}
