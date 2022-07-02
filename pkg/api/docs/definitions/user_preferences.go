package definitions

import "github.com/grafana/grafana/pkg/api/dtos"

// swagger:route GET /user/preferences user_preferences getUserPreferences
//
// Get user preferences.
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 500: internalServerError

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

// swagger:route PATCH /user/preferences user_preferences patchUserPreferences
//
// Patch user preferences.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 500: internalServerError

// swagger:parameters updateUserPreferences updateOrgPreferences updateTeamPreferences
type UpdateUserPreferencesParam struct {
	// in:body
	// required:true
	Body dtos.UpdatePrefsCmd `json:"body"`
}

// swagger:response getPreferencesResponse
type GetPreferencesResponse struct {
	// in:body
	Body dtos.Prefs `json:"body"`
}

// swagger:parameters patchUserPreferences patchOrgPreferences patchTeamPreferences
type PatchUserPreferencesParam struct {
	// in:body
	// required:true
	Body dtos.PatchPrefsCmd `json:"body"`
}
