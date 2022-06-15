package definitions

import "github.com/grafana/grafana/pkg/api/dtos"

// swagger:route GET /org/preferences org_preferences getOrgPreferences
//
// Get Current Org Prefs.
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route PUT /org/preferences org_preferences updateOrgPreferences
//
// Update Current Org Prefs.
//
// Responses:
// 200: addOrgUser
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route PATCH /org/preferences org_preferences patchOrgPreferences
//
// Patch Current Org Prefs.
//
// Responses:
// 200: addOrgUser
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:parameters updateOrgPreferences
type UpdateOrgPreferencesParams struct {
	// in:body
	// required:true
	Body dtos.UpdatePrefsCmd `json:"body"`
}
