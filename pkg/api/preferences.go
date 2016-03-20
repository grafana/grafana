package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

// POST /api/preferences/set-home-dash
func SetHomeDashboard(c *middleware.Context, cmd m.SavePreferencesCommand) Response {

	cmd.UserId = c.UserId
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to set home dashboard", err)
	}

	return ApiSuccess("Home dashboard set")
}
