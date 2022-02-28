package definitions

import (
	"github.com/grafana/grafana/pkg/models"
)

// swagger:route GET /users users searchUsers
//
// Get users.
//
// Returns all users that the authenticated user has permission to view, admin permission required.
//
// Responses:
// 200: searchUsersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /users/search users searchUsersWithPaging
//
// Get users with paging.
//
// Responses:
// 200: searchUsersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /users/{user_id} users getUserByID
//
// Get user by id.
//
// Responses:
// 200: userResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /users/lookup users getUserByLoginOrEmail
//
// Get user by login or email.
//
// Responses:
// 200: userResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route PUT /users/{user_id} users updateUser
//
// Update user.
//
// Update the user identified by id.
//
// Responses:
// 200: userResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /users/{user_id}/orgs users getUserOrgList
//
// Get organizations for user.
//
// Get organizations for user identified by id.
//
// Responses:
// 200: getUserOrgListResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /users/{user_id}/teams users getUserTeams
//
// Get teams for user.
//
// Get teams for user identified by id.
//
// Responses:
// 200: getUserTeamsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:parameters searchUsers
type SearchUsersParams struct {
	// Limit the maximum number of users to return per page
	// in:query
	// required:false
	// default:1000
	Limit int64 `json:"perpage"`
	// Page index for starting fetching users
	// in:query
	// required:false
	// default:1
	Page int64 `json:"page"`
}

// swagger:parameters searchUsersWithPaging

type SearchUsersWithPagingParams struct {
	// Limit the maximum number of users to return per page
	// in:query
	// required:false
	// default:1000
	Limit int64 `json:"perpage"`
	// Page index for starting fetching users
	// in:query
	// required:false
	// default:1
	Page int64 `json:"page"`
	// Query allows return results where the query value is contained in one of the name, login or email fields. Query values with spaces need to be URL encoded e.g. query=Jane%20Doe
	// in:query
	// required:false
	Query string `json:"query"`
}

// swagger:parameters getUserByID updateUser getUserOrgList getUserTeams
// swagger:parameters setPassword setPermissions deleteUser getAuthTokens logoutUser revokeAuthToken
// swagger:parameters syncLDAPUser disableUser enableUser getUserQuota updateUserQuota
// swagger:parameters updateOrgUser deleteOrgUser adminUpdateOrgUser adminDeleteOrgUser
// swagger:parameters updateTeamMember removeTeamMember
// swagger:parameters listUserRoles addUserRole
// swagger:parameters listUserRoles addUserRole removeUserRole setUserRoles listUserRoles
type UserIDParam struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters getUserByLoginOrEmail
type GetUserByLoginOrEmailParam struct {
	// loginOrEmail of the user
	// in:query
	// required:true
	LoginOrEmail string `json:"loginOrEmail"`
}

// swagger:parameters updateUser updateSignedInUser
type UpdateUserParam struct {
	// To change the email, name, login, theme, provide another one.
	// in:body
	// required:true
	Body models.UpdateUserCommand `json:"body"`
}

// swagger:response searchUsersResponse
type SearchUsersResponse struct {
	// The response message
	// in: body
	Body models.SearchUserQueryResult `json:"body"`
}

// swagger:response userResponse
type UserResponse struct {
	// The response message
	// in: body
	Body models.UserProfileDTO `json:"body"`
}

// swagger:response getUserOrgListResponse
type GetUserOrgListResponse struct {
	// The response message
	// in: body
	Body []*models.UserOrgDTO `json:"body"`
}

// swagger:response getUserTeamsResponse
type GetUserTeamsResponse struct {
	// The response message
	// in: body
	Body []*models.TeamDTO `json:"body"`
}
