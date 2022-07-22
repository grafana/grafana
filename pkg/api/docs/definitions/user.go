package definitions

import "github.com/grafana/grafana/pkg/models"

// swagger:route GET /user signed_in_user getSignedInUser
//
// Get signed in User.
//
// Responses:
// 200: userResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route PUT /user signed_in_user updateSignedInUser
//
// Update signed in User.
//
// Responses:
// 200: userResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /user/using/{org_id} signed_in_user userSetUsingOrg
//
// Switch user context for signed in user.
//
// Switch user context to the given organization.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /user/orgs signed_in_user getSignedInUserOrgList
//
// Organizations of the actual User.
//
// Return a list of all organizations of the current user.
//
// Security:
// - basic:
//
// Responses:
// 200: getUserOrgListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /user/teams signed_in_user getSignedInUserTeamList
//
// Teams that the actual User is member of.
//
// Return a list of all teams that the current user is member of.
//
// Responses:
// 200: getUserOrgListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /user/stars/dashboard/{dashboard_id} signed_in_user starDashboard
//
// Star a dashboard.
//
// Stars the given Dashboard for the actual user.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route DELETE /user/stars/dashboard/{dashboard_id} signed_in_user unstarDashboard
//
// Unstar a dashboard.
//
// Deletes the starring of the given Dashboard for the actual user.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route PUT /user/password signed_in_user changeUserPassword
//
// Change Password.
//
// Changes the password for the user.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /user/quotas signed_in_user getUserQuotas
//
// Fetch user quota.
//
// Responses:
// 200: getQuotaResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route PUT /user/helpflags/{flag_id} signed_in_user setHelpFlag
//
// Set user help flag.
//
// Responses:
// 200: helpFlagResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /user/helpflags/clear signed_in_user clearHelpFlags
//
// Clear user help flag.
//
// Responses:
// 200: helpFlagResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /user/auth-tokens signed_in_user getSignedInUserAuthTokens
//
// Auth tokens of the actual User.
//
// Return a list of all auth tokens (devices) that the actual user currently have logged in from.
//
// Responses:
// 200: getAuthTokensResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /user/revoke-auth-token signed_in_user revokeSignedInAuthToken
//
// Revoke an auth token of the actual User.
//
// Revokes the given auth token (device) for the actual user. User of issued auth token (device) will no longer be logged in and will be required to authenticate again upon next activity.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:parameters updateSignedInUser
type UpdateSignedInUserParams struct {
	// To change the email, name, login, theme, provide another one.
	// in:body
	// required:true
	Body models.UpdateUserCommand `json:"body"`
}

// swagger:parameters userSetUsingOrg
type UserSetUsingOrgParams struct {
	// in:path
	// required:true
	OrgID int64 `json:"org_id"`
}

// swagger:parameters starDashboard
type StarDashboardParams struct {
	// in:path
	// required:true
	DashboardID string `json:"dashboard_id"`
}

// swagger:parameters unstarDashboard
type UnstarDashboardParams struct {
	// in:path
	// required:true
	DashboardID string `json:"dashboard_id"`
}

// swagger:parameters setHelpFlag
type SetHelpFlagParams struct {
	// in:path
	// required:true
	FlagID string `json:"flag_id"`
}

// swagger:parameters changeUserPassword
type ChangeUserPasswordParams struct {
	// To change the email, name, login, theme, provide another one.
	// in:body
	// required:true
	Body models.ChangeUserPasswordCommand `json:"body"`
}

// swagger:parameters revokeSignedInAuthToken
type RevokeSignedINAuthTokenCmdParams struct {
	// in:body
	// required:true
	Body models.RevokeAuthTokenCmd `json:"body"`
}

// swagger:response helpFlagResponse
type HelpFlagResponse struct {
	// The response message
	// in: body
	Body struct {
		HelpFlags1 int64  `json:"helpFlags1"`
		Message    string `json:"message"`
	} `json:"body"`
}
