package api

import (
	"context"
	"net/http"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/preference/prefapi"
	"github.com/grafana/grafana/pkg/web"
)

// POST /api/preferences/set-home-dash
func (hs *HTTPServer) SetHomeDashboard(c *contextmodel.ReqContext) response.Response {
	cmd := pref.SavePreferenceCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	userID, err := identity.UserIdentifier(c.GetID())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to set home dashboard", err)
	}

	cmd.UserID = userID
	cmd.OrgID = c.GetOrgID()

	// convert dashboard UID to ID in order to store internally if it exists in the query, otherwise take the id from query
	// nolint:staticcheck
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
	} else if cmd.HomeDashboardID != 0 { // nolint:staticcheck
		// make sure uid is always set if id is set
		queryResult, err := hs.DashboardService.GetDashboard(c.Req.Context(), &dashboards.GetDashboardQuery{ID: cmd.HomeDashboardID, OrgID: cmd.OrgID}) // nolint:staticcheck
		if err != nil {
			return response.Error(http.StatusNotFound, "Dashboard not found", err)
		}
		cmd.HomeDashboardUID = &queryResult.UID
	}

	// nolint:staticcheck
	cmd.HomeDashboardID = dashboardID

	if err := hs.preferenceService.Save(c.Req.Context(), &cmd); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to set home dashboard", err)
	}

	return response.Success("Home dashboard set")
}

// swagger:route GET /user/preferences signed_in_user preferences getUserPreferences
//
// Get user preferences.
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetUserPreferences(c *contextmodel.ReqContext) response.Response {
	userID, err := identity.UserIdentifier(c.GetID())
	if err != nil {
		return response.Error(http.StatusUnauthorized, "Not a valid identity", err)
	}

	return prefapi.GetPreferencesFor(c.Req.Context(), hs.DashboardService, hs.preferenceService, hs.Features, c.GetOrgID(), userID, 0)
}

// swagger:route PUT /user/preferences signed_in_user preferences updateUserPreferences
//
// Update user preferences.
//
// Omitting a key (`theme`, `homeDashboardUID`, `timezone`) will cause the current value to be replaced with the system default value.
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

	userID, err := identity.UserIdentifier(c.GetID())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update user preferences", err)
	}

	return prefapi.UpdatePreferencesFor(c.Req.Context(), hs.DashboardService,
		hs.preferenceService, hs.Features, c.GetOrgID(), userID, 0, &dtoCmd)
}

// swagger:route PATCH /user/preferences signed_in_user preferences patchUserPreferences
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

	userID, err := identity.UserIdentifier(c.GetID())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update user preferences", err)
	}

	return hs.patchPreferencesFor(c.Req.Context(), c.GetOrgID(), userID, 0, &dtoCmd)
}

func (hs *HTTPServer) patchPreferencesFor(ctx context.Context, orgID, userID, teamId int64, dtoCmd *dtos.PatchPrefsCmd) response.Response {
	if dtoCmd.Theme != nil && !pref.IsValidThemeID(*dtoCmd.Theme) {
		return response.Error(http.StatusBadRequest, "Invalid theme", nil)
	}

	// convert dashboard UID to ID in order to store internally if it exists in the query, otherwise take the id from query
	// nolint:staticcheck
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
	} else if dtoCmd.HomeDashboardID != nil {
		// make sure uid is always set if id is set
		queryResult, err := hs.DashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{ID: *dtoCmd.HomeDashboardID, OrgID: orgID}) // nolint:staticcheck
		if err != nil {
			return response.Error(http.StatusNotFound, "Dashboard not found", err)
		}
		dtoCmd.HomeDashboardUID = &queryResult.UID
	}

	// nolint:staticcheck
	dtoCmd.HomeDashboardID = dashboardID

	patchCmd := pref.PatchPreferenceCommand{
		UserID:            userID,
		OrgID:             orgID,
		TeamID:            teamId,
		Theme:             dtoCmd.Theme,
		Timezone:          dtoCmd.Timezone,
		WeekStart:         dtoCmd.WeekStart,
		HomeDashboardID:   dtoCmd.HomeDashboardID, // nolint:staticcheck
		HomeDashboardUID:  dtoCmd.HomeDashboardUID,
		Language:          dtoCmd.Language,
		RegionalFormat:    dtoCmd.RegionalFormat,
		QueryHistory:      dtoCmd.QueryHistory,
		CookiePreferences: dtoCmd.Cookies,
		Navbar:            dtoCmd.Navbar,
	}

	if err := hs.preferenceService.Patch(ctx, &patchCmd); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to save preferences", err)
	}

	return response.Success("Preferences updated")
}

// swagger:route GET /org/preferences org preferences getOrgPreferences
//
// Get Current Org Prefs.
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetOrgPreferences(c *contextmodel.ReqContext) response.Response {
	return prefapi.GetPreferencesFor(c.Req.Context(), hs.DashboardService, hs.preferenceService, hs.Features, c.GetOrgID(), 0, 0)
}

// swagger:route PUT /org/preferences org preferences updateOrgPreferences
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

	return prefapi.UpdatePreferencesFor(c.Req.Context(), hs.DashboardService, hs.preferenceService, hs.Features, c.GetOrgID(), 0, 0, &dtoCmd)
}

// swagger:route PATCH /org/preferences org preferences patchOrgPreferences
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
	return hs.patchPreferencesFor(c.Req.Context(), c.GetOrgID(), 0, 0, &dtoCmd)
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
	Body preferences.PreferencesSpec `json:"body"`
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
