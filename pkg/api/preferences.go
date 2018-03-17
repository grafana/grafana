package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

// POST /api/preferences/set-home-dash
func SetHomeDashboard(c *m.ReqContext, cmd m.SavePreferencesCommand) Response {

	cmd.UserId = c.UserId
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to set home dashboard", err)
	}

	return ApiSuccess("Home dashboard set")
}

// GET /api/user/preferences
func GetUserPreferences(c *m.ReqContext) Response {
	return getPreferencesFor(c.OrgId, c.UserId)
}

func getPreferencesFor(orgId int64, userId int64) Response {
	prefsQuery := m.GetPreferencesQuery{UserId: userId, OrgId: orgId}

	if err := bus.Dispatch(&prefsQuery); err != nil {
		return ApiError(500, "Failed to get preferences", err)
	}

	dto := dtos.Prefs{
		Theme:           prefsQuery.Result.Theme,
		HomeDashboardId: prefsQuery.Result.HomeDashboardId,
		Timezone:        prefsQuery.Result.Timezone,
	}

	return Json(200, &dto)
}

// PUT /api/user/preferences
func UpdateUserPreferences(c *m.ReqContext, dtoCmd dtos.UpdatePrefsCmd) Response {
	return updatePreferencesFor(c.OrgId, c.UserId, &dtoCmd)
}

func updatePreferencesFor(orgId int64, userId int64, dtoCmd *dtos.UpdatePrefsCmd) Response {
	saveCmd := m.SavePreferencesCommand{
		UserId:          userId,
		OrgId:           orgId,
		Theme:           dtoCmd.Theme,
		Timezone:        dtoCmd.Timezone,
		HomeDashboardId: dtoCmd.HomeDashboardId,
	}

	if err := bus.Dispatch(&saveCmd); err != nil {
		return ApiError(500, "Failed to save preferences", err)
	}

	return ApiSuccess("Preferences updated")
}

// GET /api/org/preferences
func GetOrgPreferences(c *m.ReqContext) Response {
	return getPreferencesFor(c.OrgId, 0)
}

// PUT /api/org/preferences
func UpdateOrgPreferences(c *m.ReqContext, dtoCmd dtos.UpdatePrefsCmd) Response {
	return updatePreferencesFor(c.OrgId, 0, &dtoCmd)
}
