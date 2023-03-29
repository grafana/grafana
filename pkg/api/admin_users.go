package api

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/auth"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route POST /admin/users admin_users adminCreateUser
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
// 200: adminCreateUserResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 412: preconditionFailedError
// 500: internalServerError
func (hs *HTTPServer) AdminCreateUser(c *contextmodel.ReqContext) response.Response {
	form := dtos.AdminCreateUserForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	form.Email = strings.TrimSpace(form.Email)
	form.Login = strings.TrimSpace(form.Login)

	cmd := user.CreateUserCommand{
		Login:    form.Login,
		Email:    form.Email,
		Password: form.Password,
		Name:     form.Name,
		OrgID:    form.OrgId,
	}

	if len(cmd.Login) == 0 {
		cmd.Login = cmd.Email
		if len(cmd.Login) == 0 {
			return response.Error(400, "Validation error, need specify either username or email", nil)
		}
	}

	if len(cmd.Password) < 4 {
		return response.Error(400, "Password is missing or too short", nil)
	}

	usr, err := hs.userService.Create(c.Req.Context(), &cmd)
	if err != nil {
		if errors.Is(err, org.ErrOrgNotFound) {
			return response.Error(http.StatusBadRequest, err.Error(), nil)
		}

		if errors.Is(err, user.ErrUserAlreadyExists) {
			return response.Error(http.StatusPreconditionFailed, fmt.Sprintf("User with email '%s' or username '%s' already exists", form.Email, form.Login), err)
		}

		return response.Error(http.StatusInternalServerError, "failed to create user", err)
	}

	metrics.MApiAdminUserCreate.Inc()

	result := user.AdminCreateUserResponse{
		Message: "User created",
		ID:      usr.ID,
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:route PUT /admin/users/{user_id}/password admin_users adminUpdateUserPassword
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
func (hs *HTTPServer) AdminUpdateUserPassword(c *contextmodel.ReqContext) response.Response {
	form := dtos.AdminUpdateUserPasswordForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	if len(form.Password) < 4 {
		return response.Error(400, "New password too short", nil)
	}

	userQuery := user.GetUserByIDQuery{ID: userID}

	usr, err := hs.userService.GetByID(c.Req.Context(), &userQuery)
	if err != nil {
		return response.Error(500, "Could not read user from database", err)
	}

	passwordHashed, err := util.EncodePassword(form.Password, usr.Salt)
	if err != nil {
		return response.Error(500, "Could not encode password", err)
	}

	cmd := user.ChangeUserPasswordCommand{
		UserID:      userID,
		NewPassword: passwordHashed,
	}

	if err := hs.userService.ChangePassword(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update user password", err)
	}

	return response.Success("User password updated")
}

// swagger:route PUT /admin/users/{user_id}/permissions admin_users adminUpdateUserPermissions
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
func (hs *HTTPServer) AdminUpdateUserPermissions(c *contextmodel.ReqContext) response.Response {
	form := dtos.AdminUpdateUserPermissionsForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	err = hs.userService.UpdatePermissions(c.Req.Context(), userID, form.IsGrafanaAdmin)
	if err != nil {
		if errors.Is(err, user.ErrLastGrafanaAdmin) {
			return response.Error(400, user.ErrLastGrafanaAdmin.Error(), nil)
		}

		return response.Error(500, "Failed to update user permissions", err)
	}

	return response.Success("User permissions updated")
}

// swagger:route DELETE /admin/users/{user_id} admin_users adminDeleteUser
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
func (hs *HTTPServer) AdminDeleteUser(c *contextmodel.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	cmd := user.DeleteUserCommand{UserID: userID}

	if err := hs.userService.Delete(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(404, user.ErrUserNotFound.Error(), nil)
		}
		return response.Error(500, "Failed to delete user", err)
	}

	g, ctx := errgroup.WithContext(c.Req.Context())
	g.Go(func() error {
		if err := hs.starService.DeleteByUser(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := hs.orgService.DeleteUserFromAll(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := hs.DashboardService.DeleteACLByUser(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := hs.preferenceService.DeleteByUser(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := hs.teamGuardian.DeleteByUser(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := hs.authInfoService.DeleteUserAuthInfo(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := hs.AuthTokenService.RevokeAllUserTokens(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := hs.QuotaService.DeleteQuotaForUser(ctx, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	g.Go(func() error {
		if err := hs.accesscontrolService.DeleteUserPermissions(ctx, accesscontrol.GlobalOrgID, cmd.UserID); err != nil {
			return err
		}
		return nil
	})
	if err := g.Wait(); err != nil {
		return response.Error(500, "Failed to delete user", err)
	}

	return response.Success("User deleted")
}

// swagger:route POST /admin/users/{user_id}/disable admin_users adminDisableUser
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
func (hs *HTTPServer) AdminDisableUser(c *contextmodel.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	// External users shouldn't be disabled from API
	authInfoQuery := &login.GetAuthInfoQuery{UserId: userID}
	if err := hs.authInfoService.GetAuthInfo(c.Req.Context(), authInfoQuery); !errors.Is(err, user.ErrUserNotFound) {
		return response.Error(500, "Could not disable external user", nil)
	}

	disableCmd := user.DisableUserCommand{UserID: userID, IsDisabled: true}
	if err := hs.userService.Disable(c.Req.Context(), &disableCmd); err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(404, user.ErrUserNotFound.Error(), nil)
		}
		return response.Error(500, "Failed to disable user", err)
	}

	err = hs.AuthTokenService.RevokeAllUserTokens(c.Req.Context(), userID)
	if err != nil {
		return response.Error(500, "Failed to disable user", err)
	}

	return response.Success("User disabled")
}

// swagger:route POST /admin/users/{user_id}/enable admin_users adminEnableUser
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
func (hs *HTTPServer) AdminEnableUser(c *contextmodel.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	// External users shouldn't be disabled from API
	authInfoQuery := &login.GetAuthInfoQuery{UserId: userID}
	if err := hs.authInfoService.GetAuthInfo(c.Req.Context(), authInfoQuery); !errors.Is(err, user.ErrUserNotFound) {
		return response.Error(500, "Could not enable external user", nil)
	}

	disableCmd := user.DisableUserCommand{UserID: userID, IsDisabled: false}
	if err := hs.userService.Disable(c.Req.Context(), &disableCmd); err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(404, user.ErrUserNotFound.Error(), nil)
		}
		return response.Error(500, "Failed to enable user", err)
	}

	return response.Success("User enabled")
}

// swagger:route POST /admin/users/{user_id}/logout admin_users adminLogoutUser
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
func (hs *HTTPServer) AdminLogoutUser(c *contextmodel.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	if c.UserID == userID {
		return response.Error(400, "You cannot logout yourself", nil)
	}

	return hs.logoutUserFromAllDevicesInternal(c.Req.Context(), userID)
}

// swagger:route GET /admin/users/{user_id}/auth-tokens admin_users adminGetUserAuthTokens
//
// Return a list of all auth tokens (devices) that the user currently have logged in from.
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.authtoken:list` and scope `global.users:*`.
//
// Security:
// - basic:
//
// Responses:
// 200: adminGetUserAuthTokensResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) AdminGetUserAuthTokens(c *contextmodel.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return hs.getUserAuthTokensInternal(c, userID)
}

// swagger:route POST /admin/users/{user_id}/revoke-auth-token admin_users adminRevokeUserAuthToken
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
func (hs *HTTPServer) AdminRevokeUserAuthToken(c *contextmodel.ReqContext) response.Response {
	cmd := auth.RevokeAuthTokenCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return hs.revokeUserAuthTokenInternal(c, userID, cmd)
}

// swagger:parameters adminUpdateUserPassword
type AdminUpdateUserPasswordParams struct {
	// in:body
	// required:true
	Body dtos.AdminUpdateUserPasswordForm `json:"body"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters adminDeleteUser
type AdminDeleteUserParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters adminEnableUser
type AdminEnableUserParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters adminDisableUser
type AdminDisableUserParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters adminGetUserAuthTokens
type AdminGetUserAuthTokensParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters adminLogoutUser
type AdminLogoutUserParams struct {
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters adminRevokeUserAuthToken
type AdminRevokeUserAuthTokenParams struct {
	// in:body
	// required:true
	Body auth.RevokeAuthTokenCmd `json:"body"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:parameters adminCreateUser
type AdminCreateUserParams struct {
	// in:body
	// required:true
	Body dtos.AdminCreateUserForm `json:"body"`
}

// swagger:parameters adminUpdateUserPermissions
type AdminUpdateUserPermissionsParams struct {
	// in:body
	// required:true
	Body dtos.AdminUpdateUserPermissionsForm `json:"body"`
	// in:path
	// required:true
	UserID int64 `json:"user_id"`
}

// swagger:response adminCreateUserResponse
type AdminCreateUserResponseResponse struct {
	// in:body
	Body user.AdminCreateUserResponse `json:"body"`
}

// swagger:response adminGetUserAuthTokensResponse
type AdminGetUserAuthTokensResponse struct {
	// in:body
	Body []*auth.UserToken `json:"body"`
}
