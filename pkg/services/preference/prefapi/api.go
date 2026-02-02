// shared logic between httpserver and teamapi
package prefapi

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	kp "github.com/grafana/grafana/pkg/bmc/kafkaproducer"
	"github.com/grafana/grafana/pkg/kinds/preferences"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	pref "github.com/grafana/grafana/pkg/services/preference"
)

// BMC Change: Function definition inline
// Have context model instead of Req.Context in the argument to be able to push Audit Kafka Event
func UpdatePreferencesFor(c *contextmodel.ReqContext,
	dashboardService dashboards.DashboardService, preferenceService pref.Service,
	orgID, userID, teamId int64, dtoCmd *dtos.UpdatePrefsCmd) response.Response {

	//BMC Code - Start
	ctx := c.Req.Context()
	prePref := pref.Preference{}
	if userID == 0 && teamId == 0 {
		prePref = getPreferences(ctx, preferenceService, orgID, userID, teamId)
	}
	//End

	if dtoCmd.Theme != "" && !pref.IsValidThemeID(dtoCmd.Theme) {
		return response.Error(http.StatusBadRequest, "Invalid theme when updating preferences", nil)
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
		// BMC code - start
		TimeFormat:        dtoCmd.TimeFormat,
		EnabledQueryTypes: dtoCmd.EnabledQueryTypes,
		// BMC code - end
	}

	if err := preferenceService.Save(ctx, &saveCmd); err != nil {
		//BMC Code - start
		if userID == 0 && teamId == 0 {
			kp.PreferencesEvent.Send(kp.EventOpt{Ctx: c, Err: err, OperationSubType: "Failed to save organization preferences. Error : " + err.Error()})
		}
		//BMC Code - end
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to save preferences", err)
	}

	//BMC Code - start
	if userID == 0 && teamId == 0 {
		newPref := getPreferences(ctx, preferenceService, orgID, userID, teamId)
		kp.PreferencesEvent.Send(kp.EventOpt{Ctx: c, Prev: prePref, New: newPref, OperationSubType: "Organization preference updated successfully"})
	}
	//BMC Code - end

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

		if preference.JSONData.Navbar.BookmarkUrls != nil {
			dto.Navbar = &preferences.NavbarPreference{
				BookmarkUrls: []string{},
			}
			dto.Navbar.BookmarkUrls = preference.JSONData.Navbar.BookmarkUrls
		}

		if preference.JSONData.QueryHistory.HomeTab != "" {
			dto.QueryHistory = &preferences.QueryHistoryPreference{
				HomeTab: &preference.JSONData.QueryHistory.HomeTab,
			}
		}

		// BMC Code: Start
		if preference.JSONData.TimeFormat != "" {
			dto.TimeFormat = &preference.JSONData.TimeFormat
		}

		dto.EnabledQueryTypes = &preferences.EnabledQueryTypes{
			EnabledTypes:  []string{"FORM", "SQL", "VQB"},
			ApplyForAdmin: &preference.JSONData.EnabledQueryTypes.ApplyForAdmin,
		}

		if len(preference.JSONData.EnabledQueryTypes.EnabledTypes) > 0 {
			dto.EnabledQueryTypes.EnabledTypes = preference.JSONData.EnabledQueryTypes.EnabledTypes
		}
		// BMC Code: End
	}

	return response.JSON(http.StatusOK, &dto)
}

// BMC code - start
func getPreferences(ctx context.Context, preferenceService pref.Service,
	orgID, userID, teamID int64) pref.Preference {
	prefsQuery := pref.GetPreferenceQuery{UserID: userID, OrgID: orgID, TeamID: teamID}
	preference, err := preferenceService.Get(ctx, &prefsQuery)
	if err != nil {
		fmt.Println("Failed to get preference")
	}
	prePref := *preference
	return prePref
}

//BMC Code - end
