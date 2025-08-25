// shared logic between httpserver and teamapi
package prefapi

import (
	"context"
	"net/http"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

func UpdatePreferencesFor(ctx context.Context,
	dashboardService dashboards.DashboardService, preferenceService pref.Service, features featuremgmt.FeatureToggles,
	orgID, userID, teamId int64, dtoCmd *dtos.UpdatePrefsCmd) response.Response {
	if dtoCmd.Theme != "" && !pref.IsValidThemeID(dtoCmd.Theme) {
		return response.Error(http.StatusBadRequest, "Invalid theme", nil)
	}

	// convert dashboard UID to ID in order to store internally if it exists in the query, otherwise take the id from query
	// nolint:staticcheck
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
	} else if dtoCmd.HomeDashboardID != 0 {
		// make sure uid is always set if id is set
		queryResult, err := dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{ID: dtoCmd.HomeDashboardID, OrgID: orgID}) // nolint:staticcheck
		if err != nil {
			return response.Error(http.StatusNotFound, "Dashboard not found", err)
		}
		dtoCmd.HomeDashboardUID = &queryResult.UID
	}
	// nolint:staticcheck
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
		HomeDashboardUID:  dtoCmd.HomeDashboardUID,
		QueryHistory:      dtoCmd.QueryHistory,
		CookiePreferences: dtoCmd.Cookies,
		Navbar:            dtoCmd.Navbar,
	}

	if features.IsEnabled(ctx, featuremgmt.FlagLocaleFormatPreference) {
		saveCmd.RegionalFormat = dtoCmd.RegionalFormat
		saveCmd.DateStyle = dtoCmd.DateStyle
	}

	if err := saveCmd.Validate(); err != nil {
		return response.Error(http.StatusBadRequest, "Invalid preferences", err)
	}

	if err := preferenceService.Save(ctx, &saveCmd); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to save preferences", err)
	}

	return response.Success("Preferences updated")
}

func GetPreferencesFor(ctx context.Context,
	dashboardService dashboards.DashboardService, preferenceService pref.Service,
	features featuremgmt.FeatureToggles, orgID, userID, teamID int64) response.Response {
	prefsQuery := pref.GetPreferenceQuery{UserID: userID, OrgID: orgID, TeamID: teamID}

	preference, err := preferenceService.Get(ctx, &prefsQuery)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get preferences", err)
	}

	dto := preferences.PreferencesSpec{}
	if preference.WeekStart != nil && *preference.WeekStart != "" {
		dto.WeekStart = preference.WeekStart
	}
	if preference.Theme != "" {
		dto.Theme = &preference.Theme
	}
	if preference.HomeDashboardUID != "" {
		dto.HomeDashboardUID = &preference.HomeDashboardUID
	}
	if preference.Timezone != "" {
		dto.Timezone = &preference.Timezone
	}

	if preference.JSONData != nil {
		if preference.JSONData.Language != "" {
			dto.Language = &preference.JSONData.Language
		}

		if features.IsEnabled(ctx, featuremgmt.FlagLocaleFormatPreference) {
			if preference.JSONData.RegionalFormat != "" {
				dto.RegionalFormat = &preference.JSONData.RegionalFormat
			}
			if preference.JSONData.DateStyle != "" {
				dto.DateStyle = &preference.JSONData.DateStyle
			}
		}

		if preference.JSONData.Navbar.BookmarkUrls != nil {
			dto.Navbar = &preferences.PreferencesNavbarPreference{
				BookmarkUrls: []string{},
			}
			dto.Navbar.BookmarkUrls = preference.JSONData.Navbar.BookmarkUrls
		}

		if preference.JSONData.QueryHistory.HomeTab != "" {
			dto.QueryHistory = &preferences.PreferencesQueryHistoryPreference{
				HomeTab: &preference.JSONData.QueryHistory.HomeTab,
			}
		}
	}

	return response.JSON(http.StatusOK, &dto)
}
