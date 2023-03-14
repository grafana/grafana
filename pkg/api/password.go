package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) SendResetPasswordEmail(c *contextmodel.ReqContext) response.Response {
	form := dtos.SendResetPasswordEmailForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if hs.Cfg.DisableLoginForm {
		return response.Error(401, "Not allowed to reset password when login form is disabled", nil)
	}

	userQuery := user.GetUserByLoginQuery{LoginOrEmail: form.UserOrEmail}

	usr, err := hs.userService.GetByLogin(c.Req.Context(), &userQuery)
	if err != nil {
		c.Logger.Info("Requested password reset for user that was not found", "user", userQuery.LoginOrEmail, "error", err)
		return response.Error(http.StatusOK, "Email sent", nil)
	}

	if usr.IsDisabled {
		c.Logger.Info("Requested password reset for disabled user", "user", userQuery.LoginOrEmail)
		return response.Error(http.StatusOK, "Email sent", nil)
	}

	getAuthQuery := login.GetAuthInfoQuery{UserId: usr.ID}
	if err := hs.authInfoService.GetAuthInfo(c.Req.Context(), &getAuthQuery); err == nil {
		authModule := getAuthQuery.Result.AuthModule
		if authModule == login.LDAPAuthModule || authModule == login.AuthProxyAuthModule {
			return response.Error(401, "Not allowed to reset password for LDAP or Auth Proxy user", nil)
		}
	}

	emailCmd := notifications.SendResetPasswordEmailCommand{User: usr}
	if err := hs.NotificationService.SendResetPasswordEmail(c.Req.Context(), &emailCmd); err != nil {
		return response.Error(500, "Failed to send email", err)
	}

	return response.Success("Email sent")
}

func (hs *HTTPServer) ResetPassword(c *contextmodel.ReqContext) response.Response {
	form := dtos.ResetUserPasswordForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	query := notifications.ValidateResetPasswordCodeQuery{Code: form.Code}

	// For now the only way to know the username to clear login attempts for is
	// to set it in the function provided to NotificationService
	var username string
	getUserByLogin := func(ctx context.Context, login string) (*user.User, error) {
		username = login
		userQuery := user.GetUserByLoginQuery{LoginOrEmail: login}
		usr, err := hs.userService.GetByLogin(ctx, &userQuery)
		return usr, err
	}

	if err := hs.NotificationService.ValidateResetPasswordCode(c.Req.Context(), &query, getUserByLogin); err != nil {
		if errors.Is(err, notifications.ErrInvalidEmailCode) {
			return response.Error(400, "Invalid or expired reset password code", nil)
		}
		return response.Error(500, "Unknown error validating email code", err)
	}

	if form.NewPassword != form.ConfirmPassword {
		return response.Error(400, "Passwords do not match", nil)
	}

	password := user.Password(form.NewPassword)
	if password.IsWeak() {
		return response.Error(400, "New password is too short", nil)
	}

	cmd := user.ChangeUserPasswordCommand{}
	cmd.UserID = query.Result.ID
	var err error
	cmd.NewPassword, err = util.EncodePassword(form.NewPassword, query.Result.Salt)
	if err != nil {
		return response.Error(500, "Failed to encode password", err)
	}

	if err := hs.userService.ChangePassword(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to change user password", err)
	}

	if err := hs.loginAttemptService.Reset(c.Req.Context(), username); err != nil {
		c.Logger.Warn("could not reset login attempts", "err", err, "username", username)
	}

	return response.Success("User password changed")
}
