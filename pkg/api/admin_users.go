package api

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) AdminCreateUser(c *models.ReqContext) response.Response {
	form := dtos.AdminCreateUserForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
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

func AdminUpdateUserPassword(c *models.ReqContext) response.Response {
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

	if err := bus.Dispatch(c.Req.Context(), &userQuery); err != nil {
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

	if err := bus.Dispatch(c.Req.Context(), &cmd); err != nil {
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

	err = updateUserPermissions(hs.SQLStore, userID, form.IsGrafanaAdmin)
	if err != nil {
		if errors.Is(err, models.ErrLastGrafanaAdmin) {
			return response.Error(400, models.ErrLastGrafanaAdmin.Error(), nil)
		}

		return response.Error(500, "Failed to update user permissions", err)
	}

	return response.Success("User permissions updated")
}

func AdminDeleteUser(c *models.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	cmd := models.DeleteUserCommand{UserId: userID}

	if err := bus.Dispatch(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return response.Error(404, models.ErrUserNotFound.Error(), nil)
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
	if err := bus.Dispatch(c.Req.Context(), authInfoQuery); !errors.Is(err, models.ErrUserNotFound) {
		return response.Error(500, "Could not disable external user", nil)
	}

	disableCmd := models.DisableUserCommand{UserId: userID, IsDisabled: true}
	if err := bus.Dispatch(c.Req.Context(), &disableCmd); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return response.Error(404, models.ErrUserNotFound.Error(), nil)
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
func AdminEnableUser(c *models.ReqContext) response.Response {
	userID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	// External users shouldn't be disabled from API
	authInfoQuery := &models.GetAuthInfoQuery{UserId: userID}
	if err := bus.Dispatch(c.Req.Context(), authInfoQuery); !errors.Is(err, models.ErrUserNotFound) {
		return response.Error(500, "Could not enable external user", nil)
	}

	disableCmd := models.DisableUserCommand{UserId: userID, IsDisabled: false}
	if err := bus.Dispatch(c.Req.Context(), &disableCmd); err != nil {
		if errors.Is(err, models.ErrUserNotFound) {
			return response.Error(404, models.ErrUserNotFound.Error(), nil)
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

// updateUserPermissions updates the user's permissions.
//
// Stubbable by tests.
var updateUserPermissions = func(sqlStore *sqlstore.SQLStore, userID int64, isAdmin bool) error {
	return sqlStore.UpdateUserPermissions(userID, isAdmin)
}
