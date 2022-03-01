package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

const (
	defaultTheme string = ""
	darkTheme    string = "dark"
	lightTheme   string = "light"
)

// POST /api/preferences/set-home-dash
func (hs *HTTPServer) SetHomeDashboard(c *models.ReqContext) response.Response {
	cmd := models.SavePreferencesCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.UserId = c.UserId
	cmd.OrgId = c.OrgId

	_, err := hs.preferencesManager.SavePreferences(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(500, "Failed to set home dashboard", err)
	}

	return response.Success("Home dashboard set")
}

// GET /api/user/preferences
func (hs *HTTPServer) GetUserPreferences(c *models.ReqContext) response.Response {
	prefsQuery := models.GetPreferencesQuery{UserId: c.UserId, OrgId: c.OrgId, TeamId: 0}

	preferences, err := hs.preferencesManager.GetPreferences(c.Req.Context(), &prefsQuery)
	if err != nil {
		return response.Error(500, "Failed to get preferences", err)
	}

	dto := dtos.Prefs{
		Theme:           preferences.Theme,
		HomeDashboardID: preferences.HomeDashboardId,
		Timezone:        preferences.Timezone,
		WeekStart:       preferences.WeekStart,
	}

	return response.JSON(200, &dto)
}

// PUT /api/user/preferences
func (hs *HTTPServer) UpdateUserPreferences(c *models.ReqContext) response.Response {
	dtoCmd := dtos.UpdatePrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.updatePreferencesFor(c.Req.Context(), c.OrgId, c.UserId, 0, &dtoCmd)
}

func (hs *HTTPServer) updatePreferencesFor(ctx context.Context, orgID, userID, teamId int64, dtoCmd *dtos.UpdatePrefsCmd) response.Response {
	if dtoCmd.Theme != lightTheme && dtoCmd.Theme != darkTheme && dtoCmd.Theme != defaultTheme {
		return response.Error(400, "Invalid theme", nil)
	}
	saveCmd := models.SavePreferencesCommand{
		UserId:          userID,
		OrgId:           orgID,
		TeamId:          teamId,
		Theme:           dtoCmd.Theme,
		Timezone:        dtoCmd.Timezone,
		WeekStart:       dtoCmd.WeekStart,
		HomeDashboardId: dtoCmd.HomeDashboardID,
	}

	_, err := hs.preferencesManager.SavePreferences(ctx, &saveCmd)
	if err != nil {
		return response.Error(500, "Failed to save preferences", err)
	}

	return response.Success("Preferences updated")
}

// GET /api/org/preferences
func (hs *HTTPServer) GetOrgPreferences(c *models.ReqContext) response.Response {
	prefsQuery := models.GetPreferencesQuery{UserId: 0, OrgId: c.OrgId, TeamId: 0}

	fmt.Println(hs.preferencesManager)
	preferences, err := hs.preferencesManager.GetPreferences(c.Req.Context(), &prefsQuery)
	if err != nil {
		return response.Error(500, "Failed to get preferences", err)
	}

	dto := dtos.Prefs{
		Theme:           preferences.Theme,
		HomeDashboardID: preferences.HomeDashboardId,
		Timezone:        preferences.Timezone,
		WeekStart:       preferences.WeekStart,
	}

	return response.JSON(200, &dto)
}

// PUT /api/org/preferences
func (hs *HTTPServer) UpdateOrgPreferences(c *models.ReqContext) response.Response {
	dtoCmd := dtos.UpdatePrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.updatePreferencesFor(c.Req.Context(), c.OrgId, 0, 0, &dtoCmd)
}
