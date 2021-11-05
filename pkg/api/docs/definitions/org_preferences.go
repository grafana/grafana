package apidocs

import "github.com/grafana/grafana/pkg/api/dtos"

// swagger:route GET /org/preferences org_preferences getOrgPreferences
//
// Get pending invites.
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route PUT /org/preferences org_preferences updateOrgPreferences
//
// Add invite.
//
// Responses:
// 200: addOrgUser
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:response getPreferencesResponse
type GetPreferencesResponse struct {
	// The response message
	// in: body
	//nolint: staticcheck // plugins.DataResponse deprecated
	Body dtos.Prefs `json:"body"`
}
