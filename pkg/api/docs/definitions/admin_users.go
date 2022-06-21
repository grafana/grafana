package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

// swagger:route POST /admin/users admin_users createUser
//
// Create new user.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users:create`.
// Note that OrgId is an optional parameter that can be used to assign a new user to a different organization when `auto_assign_org` is set to `true`.
//
// Security:
// - basic:
//
// Responses:
// 200: createUserResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 412: preconditionFailedError
// 500: internalServerError

// swagger:route PUT /admin/users/{user_id}/password admin_users setPassword
//
// Set password for user.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.password:update` and scope `global.users:*`.
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

// swagger:route PUT /admin/users/{user_id}/permissions admin_users setPermissions
//
// Set permissions for user.
//
// Only works with Basic Authentication (username and password). See introduction for an explanation.
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.permissions:update` and scope `global.users:*`.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route DELETE /admin/users/{user_id} admin_users deleteUser
//
// Delete global User.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users:delete` and scope `global.users:*`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /admin/users/{user_id}/disable admin_users disableUser
//
// Disable user.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users:disable` and scope `global.users:1` (userIDScope).
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /admin/users/{user_id}/enable admin_users enableUser
//
// Enable user.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users:enable` and scope `global.users:1` (userIDScope).
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /admin/users/{user_id}/quotas admin_users getUserQuota
//
// Fetch user quota.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.quotas:list` and scope `global.users:1` (userIDScope).
//
// Security:
// - basic:
//
// Responses:
// 200: getQuotaResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route PUT /admin/users/{user_id}/quotas/{quota_target} admin_users updateUserQuota
//
// Update user quota.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.quotas:update` and scope `global.users:1` (userIDScope).
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /admin/users/{user_id}/auth-tokens admin_users getAuthTokens
//
// Return a list of all auth tokens (devices) that the user currently have logged in from.
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.authtoken:list` and scope `global.users:*`.
//
// Security:
// - basic:
//
// Responses:
// 200: getAuthTokensResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /admin/users/{user_id}/revoke-auth-token admin_users revokeAuthToken
//
// Revoke auth token for user.
//
// Revokes the given auth token (device) for the user. User of issued auth token (device) will no longer be logged in and will be required to authenticate again upon next activity.
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.authtoken:update` and scope `global.users:*`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /admin/users/{user_id}/logout admin_users logoutUser
//
// Logout user revokes all auth tokens (devices) for the user. User of issued auth tokens (devices) will no longer be logged in and will be required to authenticate again upon next activity.
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.logout` and scope `global.users:*`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:parameters setPassword
type SetPasswordParams struct {
	// in:body
	// required:true
	Body dtos.AdminUpdateUserPasswordForm `json:"body"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters deleteUser
type DeleteUserParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters enableUser
type EnableUserParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters disableUser
type DisableUserParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters getUserQuota
type GetUserQuotaParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters updateUserQuota
type UpdateUserQuotaParams struct {
	// in:path
	// required:true
	QuotaTarget string `json:"quota_target"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters getAuthTokens
type GetAuthTokensParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters logoutUser
type LogoutUserParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters revokeAuthToken
type RevokeAuthTokenParams struct {
	// in:body
	// required:true
	Body models.RevokeAuthTokenCmd `json:"body"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters createUser
type CreateUserParam struct {
	// in:body
	// required:true
	Body dtos.AdminCreateUserForm `json:"body"`
}

// swagger:parameters updateUserQuota
type UpdateUserQuotaParam struct {
	// in:body
	// required:true
	Body models.UpdateUserQuotaCmd `json:"body"`
}

// swagger:parameters setPermissions
type SetPermissionsParams struct {
	// in:body
	// required:true
	Body dtos.AdminUpdateUserPermissionsForm `json:"body"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:response createUserResponse
type CreateUserResponse struct {
	// in:body
	Body models.UserIdDTO `json:"body"`
}

// swagger:response getSettingsResponse
type GetSettingsResponse struct {
	// in:body
	Body setting.SettingsBag `json:"body"`
}

// swagger:response getStatsResponse
type GetStatsResponse struct {
	// in:body
	Body models.AdminStats `json:"body"`
}

// swagger:response getAuthTokensResponse
type GetAuthTokensResponse struct {
	// in:body
	Body []*models.UserToken `json:"body"`
}

// swagger:response getQuotaResponse
type GetQuotaResponseResponse struct {
	// in:body
	Body []*models.UserQuotaDTO `json:"body"`
}
