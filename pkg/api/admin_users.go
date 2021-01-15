package api

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/utils"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func AdminCreateUser(c *models.ReqContext, form dtos.AdminCreateUserForm) response.Response {
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
			return utils.Error(400, "Validation error, need specify either username or email", nil)
		}
	}

	if len(cmd.Password) < 4 {
		return utils.Error(400, "Password is missing or too short", nil)
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			return utils.Error(400, err.Error(), nil)
		}

		if errors.Is(err, models.ErrUserAlreadyExists) {
			return utils.Error(412, fmt.Sprintf("User with email '%s' or username '%s' already exists", form.Email, form.Login), err)
		}

		return utils.Error(500, "failed to create user", err)
	}

	metrics.MApiAdminUserCreate.Inc()

	user := cmd.Result

	result := models.UserIdDTO{
		Message: "User created",
		Id:      user.Id,
	}

	return utils.JSON(200, result)
}

func AdminUpdateUserPassword(c *models.ReqContext, form dtos.AdminUpdateUserPasswordForm) response.Response {
	userID := c.ParamsInt64(":id")

	if len(form.Password) < 4 {
		return utils.Error(400, "New password too short", nil)
	}

	userQuery := models.GetUserByIdQuery{Id: userID}

	if err := bus.Dispatch(&userQuery); err != nil {
		return utils.Error(500, "Could not read user from database", err)
	}

	passwordHashed, err := util.EncodePassword(form.Password, userQuery.Result.Salt)
	if err != nil {
		return utils.Error(500, "Could not encode password", err)
	}

	cmd := models.ChangeUserPasswordCommand{
		UserId:      userID,
		NewPassword: passwordHashed,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		return utils.Error(500, "Failed to update user password", err)
	}

	return utils.Success("User password updated")
}

// PUT /api/admin/users/:id/permissions
func AdminUpdateUserPermissions(c *models.ReqContext, form dtos.AdminUpdateUserPermissionsForm) response.Response {
	userID := c.ParamsInt64(":id")

	cmd := models.UpdateUserPermissionsCommand{
		UserId:         userID,
		IsGrafanaAdmin: form.IsGrafanaAdmin,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrLastGrafanaAdmin) {
			return utils.Error(400, models.ErrLastGrafanaAdmin.Error(), nil)
		}

		return utils.Error(500, "Failed to update user permissions", err)
	}

	return utils.Success("User permissions updated")
}

func AdminDeleteUser(c *models.ReqContext) response.Response {
	userID := c.ParamsInt64(":id")

	cmd := models.DeleteUserCommand{UserId: userID}

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return utils.Error(404, models.ErrUserNotFound.Error(), nil)
		}
		return utils.Error(500, "Failed to delete user", err)
	}

	return utils.Success("User deleted")
}

// POST /api/admin/users/:id/disable
func (hs *HTTPServer) AdminDisableUser(c *models.ReqContext) response.Response {
	userID := c.ParamsInt64(":id")

	// External users shouldn't be disabled from API
	authInfoQuery := &models.GetAuthInfoQuery{UserId: userID}
	if err := bus.Dispatch(authInfoQuery); !errors.Is(err, models.ErrUserNotFound) {
		return utils.Error(500, "Could not disable external user", nil)
	}

	disableCmd := models.DisableUserCommand{UserId: userID, IsDisabled: true}
	if err := bus.Dispatch(&disableCmd); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return utils.Error(404, models.ErrUserNotFound.Error(), nil)
		}
		return utils.Error(500, "Failed to disable user", err)
	}

	err := hs.AuthTokenService.RevokeAllUserTokens(c.Req.Context(), userID)
	if err != nil {
		return utils.Error(500, "Failed to disable user", err)
	}

	return utils.Success("User disabled")
}

// POST /api/admin/users/:id/enable
func AdminEnableUser(c *models.ReqContext) response.Response {
	userID := c.ParamsInt64(":id")

	// External users shouldn't be disabled from API
	authInfoQuery := &models.GetAuthInfoQuery{UserId: userID}
	if err := bus.Dispatch(authInfoQuery); !errors.Is(err, models.ErrUserNotFound) {
		return utils.Error(500, "Could not enable external user", nil)
	}

	disableCmd := models.DisableUserCommand{UserId: userID, IsDisabled: false}
	if err := bus.Dispatch(&disableCmd); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return utils.Error(404, models.ErrUserNotFound.Error(), nil)
		}
		return utils.Error(500, "Failed to enable user", err)
	}

	return utils.Success("User enabled")
}

// POST /api/admin/users/:id/logout
func (hs *HTTPServer) AdminLogoutUser(c *models.ReqContext) response.Response {
	userID := c.ParamsInt64(":id")

	if c.UserId == userID {
		return utils.Error(400, "You cannot logout yourself", nil)
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
