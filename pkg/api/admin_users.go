package api

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) AdminCreateUser(c *models.ReqContext) response.Response {
	form := dtos.AdminCreateUserForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
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

	usr, err := hs.Login.CreateUser(cmd)
	if err != nil {
		if errors.Is(err, models.ErrOrgNotFound) {
			return response.Error(400, err.Error(), nil)
		}

		if errors.Is(err, user.ErrUserAlreadyExists) {
			return response.Error(412, fmt.Sprintf("User with email '%s' or username '%s' already exists", form.Email, form.Login), err)
		}

		return response.Error(500, "failed to create user", err)
	}

	metrics.MApiAdminUserCreate.Inc()

	result := models.UserIdDTO{
		Message: "User created",
		Id:      usr.ID,
	}

	return response.JSON(http.StatusOK, result)
}

func (hs *HTTPServer) AdminUpdateUserPassword(c *models.ReqContext) response.Response {
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

	userQuery := models.GetUserByIdQuery{Id: userID}

	if err := hs.SQLStore.GetUserById(c.Req.Context(), &userQuery); err != nil {
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

	if err := hs.SQLStore.ChangeUserPassword(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to update user password", err)
	}

	return response.Success("User password updated")
}

// PUT /api/admin/users/:id/permissions
func (hs *HTTPServer) AdminUpdateUserPermissions(c *models.ReqContext) response.Response {
	form := dtos.AdminUpdateUserPermissionsForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	err = hs.SQLStore.UpdateUserPermissions(userID, form.IsGrafanaAdmin)
	if err != nil {
		if errors.Is(err, user.ErrLastGrafanaAdmin) {
			return response.Error(400, user.ErrLastGrafanaAdmin.Error(), nil)
		}

		return response.Error(500, "Failed to update user permissions", err)
	}

	return response.Success("User permissions updated")
}

func (hs *HTTPServer) AdminDeleteUser(c *models.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	cmd := models.DeleteUserCommand{UserId: userID}

	if err := hs.SQLStore.DeleteUser(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(404, user.ErrUserNotFound.Error(), nil)
		}
		return response.Error(500, "Failed to delete user", err)
	}

	return response.Success("User deleted")
}

// POST /api/admin/users/:id/disable
func (hs *HTTPServer) AdminDisableUser(c *models.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	// External users shouldn't be disabled from API
	authInfoQuery := &models.GetAuthInfoQuery{UserId: userID}
	if err := hs.authInfoService.GetAuthInfo(c.Req.Context(), authInfoQuery); !errors.Is(err, user.ErrUserNotFound) {
		return response.Error(500, "Could not disable external user", nil)
	}

	disableCmd := models.DisableUserCommand{UserId: userID, IsDisabled: true}
	if err := hs.SQLStore.DisableUser(c.Req.Context(), &disableCmd); err != nil {
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

// POST /api/admin/users/:id/enable
func (hs *HTTPServer) AdminEnableUser(c *models.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	// External users shouldn't be disabled from API
	authInfoQuery := &models.GetAuthInfoQuery{UserId: userID}
	if err := hs.authInfoService.GetAuthInfo(c.Req.Context(), authInfoQuery); !errors.Is(err, user.ErrUserNotFound) {
		return response.Error(500, "Could not enable external user", nil)
	}

	disableCmd := models.DisableUserCommand{UserId: userID, IsDisabled: false}
	if err := hs.SQLStore.DisableUser(c.Req.Context(), &disableCmd); err != nil {
		if errors.Is(err, user.ErrUserNotFound) {
			return response.Error(404, user.ErrUserNotFound.Error(), nil)
		}
		return response.Error(500, "Failed to enable user", err)
	}

	return response.Success("User enabled")
}

// POST /api/admin/users/:id/logout
func (hs *HTTPServer) AdminLogoutUser(c *models.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	if c.UserId == userID {
		return response.Error(400, "You cannot logout yourself", nil)
	}

	return hs.logoutUserFromAllDevicesInternal(c.Req.Context(), userID)
}

// GET /api/admin/users/:id/auth-tokens
func (hs *HTTPServer) AdminGetUserAuthTokens(c *models.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return hs.getUserAuthTokensInternal(c, userID)
}

// POST /api/admin/users/:id/revoke-auth-token
func (hs *HTTPServer) AdminRevokeUserAuthToken(c *models.ReqContext) response.Response {
	cmd := models.RevokeAuthTokenCmd{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	return hs.revokeUserAuthTokenInternal(c, userID, cmd)
}
