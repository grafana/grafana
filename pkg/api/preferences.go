package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
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

// GET /api/user/preferences
func GetUserPreferences(c *middleware.Context) Response {
	userPrefs := m.GetPreferencesQuery{UserId: c.UserId, OrgId: c.OrgId}

	if err := bus.Dispatch(&userPrefs); err != nil {
		c.JsonApiErr(500, "Failed to get preferences", err)
	}

	dto := dtos.UserPrefs{
		Theme:           userPrefs.Result.Theme,
		HomeDashboardId: userPrefs.Result.HomeDashboardId,
		Timezone:        userPrefs.Result.Timezone,
	}

	return Json(200, &dto)
}

// PUT /api/user/preferences
func UpdateUserPreferences(c *middleware.Context, dtoCmd dtos.UpdateUserPrefsCmd) Response {
	saveCmd := m.SavePreferencesCommand{
		UserId:          c.UserId,
		OrgId:           c.OrgId,
		Theme:           dtoCmd.Theme,
		Timezone:        dtoCmd.Timezone,
		HomeDashboardId: dtoCmd.HomeDashboardId,
	}

	if err := bus.Dispatch(&saveCmd); err != nil {
		c.JsonApiErr(500, "Failed to save preferences", err)
	}

	return ApiSuccess("User preferences updated")
}
