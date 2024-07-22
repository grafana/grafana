// shared logic between httpserver and teamapi
package prefapi

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/kinds/preferences"
	"github.com/grafana/grafana/pkg/services/dashboards"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

func UpdatePreferencesFor(ctx context.Context,
	dashboardService dashboards.DashboardService, preferenceService pref.Service,
	orgID, userID, teamId int64, dtoCmd *dtos.UpdatePrefsCmd) response.Response {
	if dtoCmd.Theme != "" && !pref.IsValidThemeID(dtoCmd.Theme) {
		return response.Error(http.StatusBadRequest, "Invalid theme", nil)
	}

	dashboardID := dtoCmd.HomeDashboardID
	if dtoCmd.HomeDashboardUID != nil {
		query := dashboards.GetDashboardQuery{UID: *dtoCmd.HomeDashboardUID, OrgID: orgID}
		if query.UID == "" {
			// clear the value
			dashboardID = 0
		} else {
			queryResult, err := dashboardService.GetDashboard(ctx, &query)
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
		Navbar:            dtoCmd.Navbar,
	}

	if err := preferenceService.Save(ctx, &saveCmd); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to save preferences", err)
	}

	return response.Success("Preferences updated")
}

func GetPreferencesFor(ctx context.Context,
	dashboardService dashboards.DashboardService, preferenceService pref.Service,
	orgID, userID, teamID int64) response.Response {
	prefsQuery := pref.GetPreferenceQuery{UserID: userID, OrgID: orgID, TeamID: teamID}

	preference, err := preferenceService.Get(ctx, &prefsQuery)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get preferences", err)
	}

	var dashboardUID string

	// when homedashboardID is 0, that means it is the default home dashboard, no UID would be returned in the response
	if preference.HomeDashboardID != 0 {
		query := dashboards.GetDashboardQuery{ID: preference.HomeDashboardID, OrgID: orgID}
		queryResult, err := dashboardService.GetDashboard(ctx, &query)
		if err == nil {
			dashboardUID = queryResult.UID
		}
	}

	dto := preferences.Spec{}

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

		if preference.JSONData.Navbar.BookmarkIds != nil {
			dto.Navbar = &preferences.NavbarPreference{
				BookmarkIds: []string{},
			}
			dto.Navbar.BookmarkIds = preference.JSONData.Navbar.BookmarkIds
		}

		if preference.JSONData.QueryHistory.HomeTab != "" {
			dto.QueryHistory = &preferences.QueryHistoryPreference{
				HomeTab: &preference.JSONData.QueryHistory.HomeTab,
			}
		}
	}

	return response.JSON(http.StatusOK, &dto)
}
