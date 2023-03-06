package api

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/kinds/preferences"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/web"
)

const (
	defaultTheme string = ""
	darkTheme    string = "dark"
	lightTheme   string = "light"
	systemTheme  string = "system"
)

// POST /api/preferences/set-home-dash
func (hs *HTTPServer) SetHomeDashboard(c *contextmodel.ReqContext) response.Response {
	cmd := pref.SavePreferenceCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.UserID = c.UserID
	cmd.OrgID = c.OrgID

	// the default value of HomeDashboardID is taken from input, when HomeDashboardID is set also,
	// UID is used in preference to identify dashboard
	dashboardID := cmd.HomeDashboardID
	if cmd.HomeDashboardUID != nil {
		query := dashboards.GetDashboardQuery{UID: *cmd.HomeDashboardUID}
		if query.UID == "" {
			dashboardID = 0 // clear the value
		} else {
			queryResult, err := hs.DashboardService.GetDashboard(c.Req.Context(), &query)
			if err != nil {
				return response.Error(http.StatusNotFound, "Dashboard not found", err)
			}
			dashboardID = queryResult.ID
		}
	}

	cmd.HomeDashboardID = dashboardID

	if err := hs.preferenceService.Save(c.Req.Context(), &cmd); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to set home dashboard", err)
	}

	return response.Success("Home dashboard set")
}

// swagger:route GET /user/preferences user_preferences getUserPreferences
//
// Get user preferences.
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetUserPreferences(c *contextmodel.ReqContext) response.Response {
	return hs.getPreferencesFor(c.Req.Context(), c.OrgID, c.UserID, 0)
}

func (hs *HTTPServer) getPreferencesFor(ctx context.Context, orgID, userID, teamID int64) response.Response {
	prefsQuery := pref.GetPreferenceQuery{UserID: userID, OrgID: orgID, TeamID: teamID}

	preference, err := hs.preferenceService.Get(ctx, &prefsQuery)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get preferences", err)
	}

	var dashboardUID string

	// when homedashboardID is 0, that means it is the default home dashboard, no UID would be returned in the response
	if preference.HomeDashboardID != 0 {
		query := dashboards.GetDashboardQuery{ID: preference.HomeDashboardID, OrgID: orgID}
		queryResult, err := hs.DashboardService.GetDashboard(ctx, &query)
		if err == nil {
			dashboardUID = queryResult.UID
		}
	}

	dto := preferences.Preferences{}

	if preference.WeekStart != nil && *preference.WeekStart != "" {
		dto.WeekStart = preference.WeekStart
	}
	if preference.Theme != "" {
		dto.Theme = &preference.Theme
	}
	if dashboardUID != "" {
		dto.HomeDashboardUID = &dashboardUID
	}
	if preference.Timezone != "" {
		dto.Timezone = &preference.Timezone
	}

	if preference.JSONData != nil {
		if preference.JSONData.Language != "" {
			dto.Language = &preference.JSONData.Language
		}

		if preference.JSONData.QueryHistory.HomeTab != "" {
			dto.QueryHistory = &preferences.QueryHistoryPreference{
				HomeTab: &preference.JSONData.QueryHistory.HomeTab,
			}
		}
	}

	return response.JSON(http.StatusOK, &dto)
}

// swagger:route PUT /user/preferences user_preferences updateUserPreferences
//
// Update user preferences.
//
// Omitting a key (`theme`, `homeDashboardId`, `timezone`) will cause the current value to be replaced with the system default value.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) UpdateUserPreferences(c *contextmodel.ReqContext) response.Response {
	dtoCmd := dtos.UpdatePrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.updatePreferencesFor(c.Req.Context(), c.OrgID, c.UserID, 0, &dtoCmd)
}

func (hs *HTTPServer) updatePreferencesFor(ctx context.Context, orgID, userID, teamId int64, dtoCmd *dtos.UpdatePrefsCmd) response.Response {
	if dtoCmd.Theme != lightTheme && dtoCmd.Theme != darkTheme && dtoCmd.Theme != defaultTheme && dtoCmd.Theme != systemTheme {
		return response.Error(400, "Invalid theme", nil)
	}

	dashboardID := dtoCmd.HomeDashboardID
	if dtoCmd.HomeDashboardUID != nil {
		query := dashboards.GetDashboardQuery{UID: *dtoCmd.HomeDashboardUID, OrgID: orgID}
		if query.UID == "" {
			// clear the value
			dashboardID = 0
		} else {
			queryResult, err := hs.DashboardService.GetDashboard(ctx, &query)
			if err != nil {
				return response.Error(http.StatusNotFound, "Dashboard not found", err)
			}
			dashboardID = queryResult.ID
		}
	}
	dtoCmd.HomeDashboardID = dashboardID

	saveCmd := pref.SavePreferenceCommand{
		UserID:            userID,
		OrgID:             orgID,
		TeamID:            teamId,
		Theme:             dtoCmd.Theme,
		Language:          dtoCmd.Language,
		Timezone:          dtoCmd.Timezone,
		WeekStart:         dtoCmd.WeekStart,
		HomeDashboardID:   dtoCmd.HomeDashboardID,
		QueryHistory:      dtoCmd.QueryHistory,
		CookiePreferences: dtoCmd.Cookies,
	}

	if err := hs.preferenceService.Save(ctx, &saveCmd); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to save preferences", err)
	}

	return response.Success("Preferences updated")
}

// swagger:route PATCH /user/preferences user_preferences patchUserPreferences
//
// Patch user preferences.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) PatchUserPreferences(c *contextmodel.ReqContext) response.Response {
	dtoCmd := dtos.PatchPrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.patchPreferencesFor(c.Req.Context(), c.OrgID, c.UserID, 0, &dtoCmd)
}

func (hs *HTTPServer) patchPreferencesFor(ctx context.Context, orgID, userID, teamId int64, dtoCmd *dtos.PatchPrefsCmd) response.Response {
	if dtoCmd.Theme != nil && *dtoCmd.Theme != lightTheme && *dtoCmd.Theme != darkTheme && *dtoCmd.Theme != defaultTheme && *dtoCmd.Theme != systemTheme {
		return response.Error(http.StatusBadRequest, "Invalid theme", nil)
	}

	// convert dashboard UID to ID in order to store internally if it exists in the query, otherwise take the id from query
	dashboardID := dtoCmd.HomeDashboardID
	if dtoCmd.HomeDashboardUID != nil {
		query := dashboards.GetDashboardQuery{UID: *dtoCmd.HomeDashboardUID, OrgID: orgID}
		if query.UID == "" {
			// clear the value
			defaultDash := int64(0)
			dashboardID = &defaultDash
		} else {
			queryResult, err := hs.DashboardService.GetDashboard(ctx, &query)
			if err != nil {
				return response.Error(http.StatusNotFound, "Dashboard not found", err)
			}
			dashboardID = &queryResult.ID
		}
	}
	dtoCmd.HomeDashboardID = dashboardID

	patchCmd := pref.PatchPreferenceCommand{
		UserID:            userID,
		OrgID:             orgID,
		TeamID:            teamId,
		Theme:             dtoCmd.Theme,
		Timezone:          dtoCmd.Timezone,
		WeekStart:         dtoCmd.WeekStart,
		HomeDashboardID:   dtoCmd.HomeDashboardID,
		Language:          dtoCmd.Language,
		QueryHistory:      dtoCmd.QueryHistory,
		CookiePreferences: dtoCmd.Cookies,
	}

	if err := hs.preferenceService.Patch(ctx, &patchCmd); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to save preferences", err)
	}

	return response.Success("Preferences updated")
}

// swagger:route GET /org/preferences org_preferences getOrgPreferences
//
// Get Current Org Prefs.
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetOrgPreferences(c *contextmodel.ReqContext) response.Response {
	return hs.getPreferencesFor(c.Req.Context(), c.OrgID, 0, 0)
}

// swagger:route PUT /org/preferences org_preferences updateOrgPreferences
//
// Update Current Org Prefs.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) UpdateOrgPreferences(c *contextmodel.ReqContext) response.Response {
	dtoCmd := dtos.UpdatePrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	return hs.updatePreferencesFor(c.Req.Context(), c.OrgID, 0, 0, &dtoCmd)
}

// swagger:route PATCH /org/preferences org_preferences patchOrgPreferences
//
// Patch Current Org Prefs.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) PatchOrgPreferences(c *contextmodel.ReqContext) response.Response {
	dtoCmd := dtos.PatchPrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.patchPreferencesFor(c.Req.Context(), c.OrgID, 0, 0, &dtoCmd)
}

// swagger:parameters  updateUserPreferences
type UpdateUserPreferencesParams struct {
	// in:body
	// required:true
	Body dtos.UpdatePrefsCmd `json:"body"`
}

// swagger:parameters updateOrgPreferences
type UpdateOrgPreferencesParams struct {
	// in:body
	// required:true
	Body dtos.UpdatePrefsCmd `json:"body"`
}

// swagger:response getPreferencesResponse
type GetPreferencesResponse struct {
	// in:body
	Body preferences.Preferences `json:"body"`
}

// swagger:parameters patchUserPreferences
type PatchUserPreferencesParams struct {
	// in:body
	// required:true
	Body dtos.PatchPrefsCmd `json:"body"`
}

// swagger:parameters patchOrgPreferences
type PatchOrgPreferencesParams struct {
	// in:body
	// required:true
	Body dtos.PatchPrefsCmd `json:"body"`
}
