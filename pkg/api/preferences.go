package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

// POST /api/preferences/set-home-dash
func SetHomeDashboard(c *models.ReqContext, cmd models.SavePreferencesCommand) response.Response {
	cmd.UserId = c.UserId
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		return response.Error(500, "Failed to set home dashboard", err)
	}

	return response.Success("Home dashboard set")
}

// GET /api/user/preferences
func GetUserPreferences(c *models.ReqContext) response.Response {
	return getPreferencesFor(c.OrgId, c.UserId, 0)
}

func getPreferencesFor(orgID, userID, teamID int64) response.Response {
	prefsQuery := models.GetPreferencesQuery{UserId: userID, OrgId: orgID, TeamId: teamID}

	if err := bus.Dispatch(&prefsQuery); err != nil {
		return response.Error(500, "Failed to get preferences", err)
	}

	dto := dtos.Prefs{
		Theme:           prefsQuery.Result.Theme,
		HomeDashboardID: prefsQuery.Result.HomeDashboardId,
		Timezone:        prefsQuery.Result.Timezone,
	}

	return response.JSON(200, &dto)
}

// PUT /api/user/preferences
func UpdateUserPreferences(c *models.ReqContext, dtoCmd dtos.UpdatePrefsCmd) response.Response {
	return updatePreferencesFor(c.OrgId, c.UserId, 0, &dtoCmd)
}

func updatePreferencesFor(orgID, userID, teamId int64, dtoCmd *dtos.UpdatePrefsCmd) response.Response {
	saveCmd := models.SavePreferencesCommand{
		UserId:          userID,
		OrgId:           orgID,
		TeamId:          teamId,
		Theme:           dtoCmd.Theme,
		Timezone:        dtoCmd.Timezone,
		HomeDashboardId: dtoCmd.HomeDashboardID,
	}

	if err := bus.Dispatch(&saveCmd); err != nil {
		return response.Error(500, "Failed to save preferences", err)
	}

	return response.Success("Preferences updated")
}

// GET /api/org/preferences
func GetOrgPreferences(c *models.ReqContext) response.Response {
	return getPreferencesFor(c.OrgId, 0, 0)
}

// PUT /api/org/preferences
func UpdateOrgPreferences(c *models.ReqContext, dtoCmd dtos.UpdatePrefsCmd) response.Response {
	return updatePreferencesFor(c.OrgId, 0, 0, &dtoCmd)
}
