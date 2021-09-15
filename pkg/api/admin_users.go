package api

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

func (hs *HTTPServer) AdminCreateUser(c *models.ReqContext, form dtos.AdminCreateUserForm) response.Response {
	cmd := models.CreateUserCommand{
		Login:    form.Login,
		Email:    form.Email,
		Password: form.Password,
		Name:     form.Name,
		OrgId:    form.OrgId,
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

	user, err := hs.Login.CreateUser(cmd)
	if err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			return response.Error(400, err.Error(), nil)
		}

		if errors.Is(err, models.ErrUserAlreadyExists) {
			return response.Error(412, fmt.Sprintf("User with email '%s' or username '%s' already exists", form.Email, form.Login), err)
		}

		return response.Error(500, "failed to create user", err)
	}

	metrics.MApiAdminUserCreate.Inc()

	result := models.UserIdDTO{
		Message: "User created",
		Id:      user.Id,
	}

	return response.JSON(200, result)
}

func AdminUpdateUserPassword(c *models.ReqContext, form dtos.AdminUpdateUserPasswordForm) response.Response {
	userID := c.ParamsInt64(":id")

	if len(form.Password) < 4 {
		return response.Error(400, "New password too short", nil)
	}

	userQuery := models.GetUserByIdQuery{Id: userID}

	if err := bus.DispatchCtx(c.Req.Context(), &userQuery); err != nil {
		return response.Error(500, "Could not read user from database", err)
	}

	passwordHashed, err := util.EncodePassword(form.Password, userQuery.Result.Salt)
	if err != nil {
		return response.Error(500, "Could not encode password", err)
	}

	cmd := models.ChangeUserPasswordCommand{
		UserId:      userID,
		NewPassword: passwordHashed,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return response.Error(500, "Failed to update user password", err)
	}

	return response.Success("User password updated")
}

// PUT /api/admin/users/:id/permissions
func (hs *HTTPServer) AdminUpdateUserPermissions(c *models.ReqContext, form dtos.AdminUpdateUserPermissionsForm) response.Response {
	userID := c.ParamsInt64(":id")

	err := updateUserPermissions(hs.SQLStore, userID, form.IsGrafanaAdmin)
	if err != nil {
		if errors.Is(err, models.ErrLastGrafanaAdmin) {
			return response.Error(400, models.ErrLastGrafanaAdmin.Error(), nil)
		}

		return response.Error(500, "Failed to update user permissions", err)
	}

	return response.Success("User permissions updated")
}

func AdminDeleteUser(c *models.ReqContext) response.Response {
	userID := c.ParamsInt64(":id")

	cmd := models.DeleteUserCommand{UserId: userID}

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return response.Error(404, models.ErrUserNotFound.Error(), nil)
		}
		return response.Error(500, "Failed to delete user", err)
	}

	return response.Success("User deleted")
}

// POST /api/admin/users/:id/disable
func (hs *HTTPServer) AdminDisableUser(c *models.ReqContext) response.Response {
	userID := c.ParamsInt64(":id")

	// External users shouldn't be disabled from API
	authInfoQuery := &models.GetAuthInfoQuery{UserId: userID}
	if err := bus.Dispatch(authInfoQuery); !errors.Is(err, models.ErrUserNotFound) {
		return response.Error(500, "Could not disable external user", nil)
	}

	disableCmd := models.DisableUserCommand{UserId: userID, IsDisabled: true}
	if err := bus.Dispatch(&disableCmd); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return response.Error(404, models.ErrUserNotFound.Error(), nil)
		}
		return response.Error(500, "Failed to disable user", err)
	}

	err := hs.AuthTokenService.RevokeAllUserTokens(c.Req.Context(), userID)
	if err != nil {
		return response.Error(500, "Failed to disable user", err)
	}

	return response.Success("User disabled")
}

// POST /api/admin/users/:id/enable
func AdminEnableUser(c *models.ReqContext) response.Response {
	userID := c.ParamsInt64(":id")

	// External users shouldn't be disabled from API
	authInfoQuery := &models.GetAuthInfoQuery{UserId: userID}
	if err := bus.Dispatch(authInfoQuery); !errors.Is(err, models.ErrUserNotFound) {
		return response.Error(500, "Could not enable external user", nil)
	}

	disableCmd := models.DisableUserCommand{UserId: userID, IsDisabled: false}
	if err := bus.Dispatch(&disableCmd); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return response.Error(404, models.ErrUserNotFound.Error(), nil)
		}
		return response.Error(500, "Failed to enable user", err)
	}

	return response.Success("User enabled")
}

// POST /api/admin/users/:id/logout
func (hs *HTTPServer) AdminLogoutUser(c *models.ReqContext) response.Response {
	userID := c.ParamsInt64(":id")

	if c.UserId == userID {
		return response.Error(400, "You cannot logout yourself", nil)
	}

	return hs.logoutUserFromAllDevicesInternal(c.Req.Context(), userID)
}

// GET /api/admin/users/:id/auth-tokens
func (hs *HTTPServer) AdminGetUserAuthTokens(c *models.ReqContext) response.Response {
	userID := c.ParamsInt64(":id")
	return hs.getUserAuthTokensInternal(c, userID)
}

// POST /api/admin/users/:id/revoke-auth-token
func (hs *HTTPServer) AdminRevokeUserAuthToken(c *models.ReqContext, cmd models.RevokeAuthTokenCmd) response.Response {
	userID := c.ParamsInt64(":id")
	return hs.revokeUserAuthTokenInternal(c, userID, cmd)
}

// updateUserPermissions updates the user's permissions.
//
// Stubbable by tests.
var updateUserPermissions = func(sqlStore *sqlstore.SQLStore, userID int64, isAdmin bool) error {
	return sqlStore.UpdateUserPermissions(userID, isAdmin)
}
