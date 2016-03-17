package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
)

// PUT /api/preferences
func SavePreferences(c *middleware.Context, cmd m.SavePreferencesCommand) Response {

	cmd.UserId = c.UserId
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to save preferences", err)
	}

	return ApiSuccess("Preferences saved")

}

// GET /api/preferences
func GetPreferences(c *middleware.Context) {

	query := m.GetPreferencesQuery{UserId: c.UserId, OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to get preferences", err)
	}

	dto := dtos.Preferences{
		HomeDashboardId: query.Result.HomeDashboardId,
		Timezone:        query.Result.Timezone,
		Theme:           query.Result.Theme,
	}

	c.JSON(200, dto)
}

// POST /api/preferences/set-home-dash
func SetHomeDashboard(c *middleware.Context, cmd m.SavePreferencesCommand) Response {

	cmd.UserId = c.UserId
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to set home dashboard", err)
	}

	return ApiSuccess("Home dashboard set")

}
