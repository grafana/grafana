package api

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

const (
	defaultTheme string = ""
	darkTheme    string = "dark"
	lightTheme   string = "light"
)

// POST /api/preferences/set-home-dash
func SetHomeDashboard(c *models.ReqContext) response.Response {
	cmd := models.SavePreferencesCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.UserId = c.UserId
	cmd.OrgId = c.OrgId

	if err := bus.DispatchCtx(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to set home dashboard", err)
	}

	return response.Success("Home dashboard set")
}

// GET /api/user/preferences
func (hs *HTTPServer) GetUserPreferences(c *models.ReqContext) response.Response {
	return hs.getPreferencesFor(c.Req.Context(), c.OrgId, c.UserId, 0)
}

func (hs *HTTPServer) getPreferencesFor(ctx context.Context, orgID, userID, teamID int64) response.Response {
	prefsQuery := models.GetPreferencesQuery{UserId: userID, OrgId: orgID, TeamId: teamID}

	if err := hs.SQLStore.GetPreferences(ctx, &prefsQuery); err != nil {
		return response.Error(500, "Failed to get preferences", err)
	}

	dto := dtos.Prefs{
		Theme:           prefsQuery.Result.Theme,
		HomeDashboardID: prefsQuery.Result.HomeDashboardId,
		Timezone:        prefsQuery.Result.Timezone,
		WeekStart:       prefsQuery.Result.WeekStart,
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

	if err := hs.SQLStore.SavePreferences(ctx, &saveCmd); err != nil {
		return response.Error(500, "Failed to save preferences", err)
	}

	return response.Success("Preferences updated")
}

// GET /api/org/preferences
func (hs *HTTPServer) GetOrgPreferences(c *models.ReqContext) response.Response {
	return hs.getPreferencesFor(c.Req.Context(), c.OrgId, 0, 0)
}

// PUT /api/org/preferences
func (hs *HTTPServer) UpdateOrgPreferences(c *models.ReqContext) response.Response {
	dtoCmd := dtos.UpdatePrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.updatePreferencesFor(c.Req.Context(), c.OrgId, 0, 0, &dtoCmd)
}
