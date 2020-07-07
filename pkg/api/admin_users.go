package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func AdminCreateUser(c *models.ReqContext, form dtos.AdminCreateUserForm) {
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
			c.JsonApiErr(400, "Validation error, need specify either username or email", nil)
			return
		}
	}

	if len(cmd.Password) < 4 {
		c.JsonApiErr(400, "Password is missing or too short", nil)
		return
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == models.ErrOrgNotFound {
			c.JsonApiErr(400, models.ErrOrgNotFound.Error(), nil)
			return
		}

		c.JsonApiErr(500, "failed to create user", err)
		return
	}

	metrics.MApiAdminUserCreate.Inc()

	user := cmd.Result

	result := models.UserIdDTO{
		Message: "User created",
		Id:      user.Id,
	}

	c.JSON(200, result)
}

func AdminUpdateUserPassword(c *models.ReqContext, form dtos.AdminUpdateUserPasswordForm) {
	userID := c.ParamsInt64(":id")

	if len(form.Password) < 4 {
		c.JsonApiErr(400, "New password too short", nil)
		return
	}

	userQuery := models.GetUserByIdQuery{Id: userID}

	if err := bus.Dispatch(&userQuery); err != nil {
		c.JsonApiErr(500, "Could not read user from database", err)
		return
	}

	passwordHashed, err := util.EncodePassword(form.Password, userQuery.Result.Salt)
	if err != nil {
		c.JsonApiErr(500, "Could not encode password", err)
		return
	}

	cmd := models.ChangeUserPasswordCommand{
		UserId:      userID,
		NewPassword: passwordHashed,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to update user password", err)
		return
	}

	c.JsonOK("User password updated")
}

// PUT /api/admin/users/:id/permissions
func AdminUpdateUserPermissions(c *models.ReqContext, form dtos.AdminUpdateUserPermissionsForm) {
	userID := c.ParamsInt64(":id")

	cmd := models.UpdateUserPermissionsCommand{
		UserId:         userID,
		IsGrafanaAdmin: form.IsGrafanaAdmin,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == models.ErrLastGrafanaAdmin {
			c.JsonApiErr(400, models.ErrLastGrafanaAdmin.Error(), nil)
			return
		}

		c.JsonApiErr(500, "Failed to update user permissions", err)
		return
	}

	c.JsonOK("User permissions updated")
}

func AdminDeleteUser(c *models.ReqContext) {
	userID := c.ParamsInt64(":id")

	cmd := models.DeleteUserCommand{UserId: userID}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == models.ErrUserNotFound {
			c.JsonApiErr(404, models.ErrUserNotFound.Error(), nil)
			return
		}
		c.JsonApiErr(500, "Failed to delete user", err)
		return
	}

	c.JsonOK("User deleted")
}

// POST /api/admin/users/:id/disable
func (server *HTTPServer) AdminDisableUser(c *models.ReqContext) Response {
	userID := c.ParamsInt64(":id")

	// External users shouldn't be disabled from API
	authInfoQuery := &models.GetAuthInfoQuery{UserId: userID}
	if err := bus.Dispatch(authInfoQuery); err != models.ErrUserNotFound {
		return Error(500, "Could not disable external user", nil)
	}

	disableCmd := models.DisableUserCommand{UserId: userID, IsDisabled: true}
	if err := bus.Dispatch(&disableCmd); err != nil {
		if err == models.ErrUserNotFound {
			return Error(404, models.ErrUserNotFound.Error(), nil)
		}
		return Error(500, "Failed to disable user", err)
	}

	err := server.AuthTokenService.RevokeAllUserTokens(c.Req.Context(), userID)
	if err != nil {
		return Error(500, "Failed to disable user", err)
	}

	return Success("User disabled")
}

// POST /api/admin/users/:id/enable
func AdminEnableUser(c *models.ReqContext) Response {
	userID := c.ParamsInt64(":id")

	// External users shouldn't be disabled from API
	authInfoQuery := &models.GetAuthInfoQuery{UserId: userID}
	if err := bus.Dispatch(authInfoQuery); err != models.ErrUserNotFound {
		return Error(500, "Could not enable external user", nil)
	}

	disableCmd := models.DisableUserCommand{UserId: userID, IsDisabled: false}
	if err := bus.Dispatch(&disableCmd); err != nil {
		if err == models.ErrUserNotFound {
			return Error(404, models.ErrUserNotFound.Error(), nil)
		}
		return Error(500, "Failed to enable user", err)
	}

	return Success("User enabled")
}

// POST /api/admin/users/:id/logout
func (server *HTTPServer) AdminLogoutUser(c *models.ReqContext) Response {
	userID := c.ParamsInt64(":id")

	if c.UserId == userID {
		return Error(400, "You cannot logout yourself", nil)
	}

	return server.logoutUserFromAllDevicesInternal(c.Req.Context(), userID)
}

// GET /api/admin/users/:id/auth-tokens
func (server *HTTPServer) AdminGetUserAuthTokens(c *models.ReqContext) Response {
	userID := c.ParamsInt64(":id")
	return server.getUserAuthTokensInternal(c, userID)
}

// POST /api/admin/users/:id/revoke-auth-token
func (server *HTTPServer) AdminRevokeUserAuthToken(c *models.ReqContext, cmd models.RevokeAuthTokenCmd) Response {
	userID := c.ParamsInt64(":id")
	return server.revokeUserAuthTokenInternal(c, userID, cmd)
}
