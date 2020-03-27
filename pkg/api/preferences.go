package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

// POST /api/preferences/set-home-dash
func SetHomeDashboard(c *models.ReqContext, cmd models.SavePreferencesCommand) Response {

	cmd.UserId = c.UserId
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to set home dashboard", err)
	}

	return Success("Home dashboard set")
}

// GET /api/user/preferences
func GetUserPreferences(c *models.ReqContext) Response {
	return getPreferencesFor(c.OrgId, c.UserId, 0)
}

func getPreferencesFor(orgID, userID, teamID int64) Response {
	prefsQuery := models.GetPreferencesQuery{UserId: userID, OrgId: orgID, TeamId: teamID}

	if err := bus.Dispatch(&prefsQuery); err != nil {
		return Error(500, "Failed to get preferences", err)
	}

	dto := dtos.Prefs{
		Theme:           prefsQuery.Result.Theme,
		HomeDashboardID: prefsQuery.Result.HomeDashboardId,
		Timezone:        prefsQuery.Result.Timezone,
	}

	return JSON(200, &dto)
}

// PUT /api/user/preferences
func UpdateUserPreferences(c *models.ReqContext, dtoCmd dtos.UpdatePrefsCmd) Response {
	return updatePreferencesFor(c.OrgId, c.UserId, 0, &dtoCmd)
}

func updatePreferencesFor(orgID, userID, teamId int64, dtoCmd *dtos.UpdatePrefsCmd) Response {
	saveCmd := models.SavePreferencesCommand{
		UserId:          userID,
		OrgId:           orgID,
		TeamId:          teamId,
		Theme:           dtoCmd.Theme,
		Timezone:        dtoCmd.Timezone,
		HomeDashboardId: dtoCmd.HomeDashboardID,
	}

	if err := bus.Dispatch(&saveCmd); err != nil {
		return Error(500, "Failed to save preferences", err)
	}

	return Success("Preferences updated")
}

// GET /api/org/preferences
func GetOrgPreferences(c *models.ReqContext) Response {
	return getPreferencesFor(c.OrgId, 0, 0)
}

// PUT /api/org/preferences
func UpdateOrgPreferences(c *models.ReqContext, dtoCmd dtos.UpdatePrefsCmd) Response {
	return updatePreferencesFor(c.OrgId, 0, 0, &dtoCmd)
}
