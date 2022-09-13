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
	cmd.UserID = c.UserID
	cmd.OrgID = c.OrgID

	// the default value of HomeDashboardID is taken from input, when HomeDashboardID is set also,
	// UID is used in preference to identify dashboard
	dashboardID := cmd.HomeDashboardID
	if cmd.HomeDashboardUID != nil {
		query := models.GetDashboardQuery{Uid: *cmd.HomeDashboardUID}
		if query.Uid == "" {
			dashboardID = 0 // clear the value
		} else {
			err := hs.DashboardService.GetDashboard(c.Req.Context(), &query)
			if err != nil {
				return response.Error(404, "Dashboard not found", err)
			}
			dashboardID = query.Result.Id
		}
	}

	cmd.HomeDashboardID = dashboardID

	if err := hs.preferenceService.Save(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to set home dashboard", err)
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
func (hs *HTTPServer) GetUserPreferences(c *models.ReqContext) response.Response {
	return hs.getPreferencesFor(c.Req.Context(), c.OrgID, c.UserID, 0)
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
		err = hs.DashboardService.GetDashboard(ctx, &query)
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
		dto.Locale = preference.JSONData.Locale
		dto.Navbar = preference.JSONData.Navbar
		dto.QueryHistory = preference.JSONData.QueryHistory
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
func (hs *HTTPServer) UpdateUserPreferences(c *models.ReqContext) response.Response {
	dtoCmd := dtos.UpdatePrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.updatePreferencesFor(c.Req.Context(), c.OrgID, c.UserID, 0, &dtoCmd)
}

func (hs *HTTPServer) updatePreferencesFor(ctx context.Context, orgID, userID, teamId int64, dtoCmd *dtos.UpdatePrefsCmd) response.Response {
	if dtoCmd.Theme != lightTheme && dtoCmd.Theme != darkTheme && dtoCmd.Theme != defaultTheme {
		return response.Error(400, "Invalid theme", nil)
	}

	dashboardID := dtoCmd.HomeDashboardID
	if dtoCmd.HomeDashboardUID != nil {
		query := models.GetDashboardQuery{Uid: *dtoCmd.HomeDashboardUID, OrgId: orgID}
		if query.Uid == "" {
			// clear the value
			dashboardID = 0
		} else {
			err := hs.DashboardService.GetDashboard(ctx, &query)
			if err != nil {
				return response.Error(404, "Dashboard not found", err)
			}
			dashboardID = query.Result.Id
		}
	}
	dtoCmd.HomeDashboardID = dashboardID

	saveCmd := pref.SavePreferenceCommand{
		UserID:          userID,
		OrgID:           orgID,
		TeamID:          teamId,
		Theme:           dtoCmd.Theme,
		Locale:          dtoCmd.Locale,
		Timezone:        dtoCmd.Timezone,
		WeekStart:       dtoCmd.WeekStart,
		HomeDashboardID: dtoCmd.HomeDashboardID,
		QueryHistory:    dtoCmd.QueryHistory,
		Navbar:          dtoCmd.Navbar,
	}

	if err := hs.preferenceService.Save(ctx, &saveCmd); err != nil {
		return response.Error(500, "Failed to save preferences", err)
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
func (hs *HTTPServer) PatchUserPreferences(c *models.ReqContext) response.Response {
	dtoCmd := dtos.PatchPrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.patchPreferencesFor(c.Req.Context(), c.OrgID, c.UserID, 0, &dtoCmd)
}

func (hs *HTTPServer) patchPreferencesFor(ctx context.Context, orgID, userID, teamId int64, dtoCmd *dtos.PatchPrefsCmd) response.Response {
	if dtoCmd.Theme != nil && *dtoCmd.Theme != lightTheme && *dtoCmd.Theme != darkTheme && *dtoCmd.Theme != defaultTheme {
		return response.Error(400, "Invalid theme", nil)
	}

	// convert dashboard UID to ID in order to store internally if it exists in the query, otherwise take the id from query
	dashboardID := dtoCmd.HomeDashboardID
	if dtoCmd.HomeDashboardUID != nil {
		query := models.GetDashboardQuery{Uid: *dtoCmd.HomeDashboardUID, OrgId: orgID}
		if query.Uid == "" {
			// clear the value
			defaultDash := int64(0)
			dashboardID = &defaultDash
		} else {
			err := hs.DashboardService.GetDashboard(ctx, &query)
			if err != nil {
				return response.Error(404, "Dashboard not found", err)
			}
			dashboardID = &query.Result.Id
		}
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
		Locale:          dtoCmd.Locale,
		Navbar:          dtoCmd.Navbar,
		QueryHistory:    dtoCmd.QueryHistory,
	}

	if err := hs.preferenceService.Patch(ctx, &patchCmd); err != nil {
		return response.Error(500, "Failed to save preferences", err)
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
func (hs *HTTPServer) GetOrgPreferences(c *models.ReqContext) response.Response {
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
func (hs *HTTPServer) UpdateOrgPreferences(c *models.ReqContext) response.Response {
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
func (hs *HTTPServer) PatchOrgPreferences(c *models.ReqContext) response.Response {
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
	Body dtos.Prefs `json:"body"`
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
