package api

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/web"
)

const (
	defaultTheme string = ""
	darkTheme    string = "dark"
	lightTheme   string = "light"
)

// POST /api/preferences/set-home-dash
func (hs *HTTPServer) SetHomeDashboard(c *models.ReqContext) response.Response {
	cmd := pref.SavePreferenceCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.UserID = c.UserId
	cmd.OrgID = c.OrgId

	// the default value of HomeDashboardID is taken from input, when HomeDashboardID is set also,
	// UID is used in preference to identify dashboard
	dashboardID := cmd.HomeDashboardID
	if cmd.HomeDashboardUID != nil {
		query := models.GetDashboardQuery{Uid: *cmd.HomeDashboardUID}
		err := hs.SQLStore.GetDashboard(c.Req.Context(), &query)
		if err != nil {
			return response.Error(404, "Dashboard not found", err)
		}
		dashboardID = query.Result.Id
	}

	cmd.HomeDashboardID = dashboardID

	if err := hs.preferenceService.Save(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to set home dashboard", err)
	}

	return response.Success("Home dashboard set")
}

// GET /api/user/preferences
func (hs *HTTPServer) GetUserPreferences(c *models.ReqContext) response.Response {
	return hs.getPreferencesFor(c.Req.Context(), c.OrgId, c.UserId, 0)
}

func (hs *HTTPServer) getPreferencesFor(ctx context.Context, orgID, userID, teamID int64) response.Response {
	prefsQuery := pref.GetPreferenceQuery{UserID: userID, OrgID: orgID, TeamID: teamID}

	preference, err := hs.preferenceService.Get(ctx, &prefsQuery)
	if err != nil {
		return response.Error(500, "Failed to get preferences", err)
	}

	var dashboardUID string

	// when homedashboardID is 0, that means it is the default home dashboard, no UID would be returned in the response
	if preference.HomeDashboardID != 0 {
		query := models.GetDashboardQuery{Id: preference.HomeDashboardID, OrgId: orgID}
		err = hs.SQLStore.GetDashboard(ctx, &query)
		if err == nil {
			dashboardUID = query.Result.Uid
		}
	}

	dto := dtos.Prefs{
		Theme:            preference.Theme,
		HomeDashboardID:  preference.HomeDashboardID,
		HomeDashboardUID: dashboardUID,
		Timezone:         preference.Timezone,
		WeekStart:        preference.WeekStart,
	}

	if preference.JSONData != nil {
		dto.Navbar = preference.JSONData.Navbar
		dto.QueryHistory = preference.JSONData.QueryHistory
	}

	return response.JSON(http.StatusOK, &dto)
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

	dashboardID := dtoCmd.HomeDashboardID
	if dtoCmd.HomeDashboardUID != nil {
		query := models.GetDashboardQuery{Uid: *dtoCmd.HomeDashboardUID, OrgId: orgID}
		err := hs.SQLStore.GetDashboard(ctx, &query)
		if err != nil {
			return response.Error(404, "Dashboard not found", err)
		}
		dashboardID = query.Result.Id
	}
	dtoCmd.HomeDashboardID = dashboardID

	saveCmd := pref.SavePreferenceCommand{
		UserID:          userID,
		OrgID:           orgID,
		TeamID:          teamId,
		Theme:           dtoCmd.Theme,
		Timezone:        dtoCmd.Timezone,
		WeekStart:       dtoCmd.WeekStart,
		HomeDashboardID: dtoCmd.HomeDashboardID,
	}

	if err := hs.preferenceService.Save(ctx, &saveCmd); err != nil {
		return response.Error(500, "Failed to save preferences", err)
	}

	return response.Success("Preferences updated")
}

// PATCH /api/user/preferences
func (hs *HTTPServer) PatchUserPreferences(c *models.ReqContext) response.Response {
	dtoCmd := dtos.PatchPrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.patchPreferencesFor(c.Req.Context(), c.OrgId, c.UserId, 0, &dtoCmd)
}

func (hs *HTTPServer) patchPreferencesFor(ctx context.Context, orgID, userID, teamId int64, dtoCmd *dtos.PatchPrefsCmd) response.Response {
	if dtoCmd.Theme != nil && *dtoCmd.Theme != lightTheme && *dtoCmd.Theme != darkTheme && *dtoCmd.Theme != defaultTheme {
		return response.Error(400, "Invalid theme", nil)
	}

	// convert dashboard UID to ID in order to store internally if it exists in the query, otherwise take the id from query
	dashboardID := dtoCmd.HomeDashboardID
	if dtoCmd.HomeDashboardUID != nil {
		query := models.GetDashboardQuery{Uid: *dtoCmd.HomeDashboardUID, OrgId: orgID}
		err := hs.SQLStore.GetDashboard(ctx, &query)
		if err != nil {
			return response.Error(404, "Dashboard not found", err)
		}
		dashboardID = &query.Result.Id
	}
	dtoCmd.HomeDashboardID = dashboardID

	patchCmd := pref.PatchPreferenceCommand{
		UserID:          userID,
		OrgID:           orgID,
		TeamID:          teamId,
		Theme:           dtoCmd.Theme,
		Timezone:        dtoCmd.Timezone,
		WeekStart:       dtoCmd.WeekStart,
		HomeDashboardID: dtoCmd.HomeDashboardID,
		Navbar:          dtoCmd.Navbar,
		QueryHistory:    dtoCmd.QueryHistory,
	}

	if err := hs.preferenceService.Patch(ctx, &patchCmd); err != nil {
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

// PATCH /api/org/preferences
func (hs *HTTPServer) PatchOrgPreferences(c *models.ReqContext) response.Response {
	dtoCmd := dtos.PatchPrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.patchPreferencesFor(c.Req.Context(), c.OrgId, 0, 0, &dtoCmd)
}
