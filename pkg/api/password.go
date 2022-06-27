package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) SendResetPasswordEmail(c *models.ReqContext) response.Response {
	form := dtos.SendResetPasswordEmailForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	if setting.LDAPEnabled || setting.AuthProxyEnabled {
		return response.Error(401, "Not allowed to reset password when LDAP or Auth Proxy is enabled", nil)
	}
	if setting.DisableLoginForm {
		return response.Error(401, "Not allowed to reset password when login form is disabled", nil)
	}

	userQuery := models.GetUserByLoginQuery{LoginOrEmail: form.UserOrEmail}

	if err := hs.SQLStore.GetUserByLogin(c.Req.Context(), &userQuery); err != nil {
		c.Logger.Info("Requested password reset for user that was not found", "user", userQuery.LoginOrEmail)
		return response.Error(http.StatusOK, "Email sent", err)
	}

	emailCmd := models.SendResetPasswordEmailCommand{User: userQuery.Result}
	if err := hs.NotificationService.SendResetPasswordEmail(c.Req.Context(), &emailCmd); err != nil {
		return response.Error(500, "Failed to send email", err)
	}

	return response.Success("Email sent")
}

func (hs *HTTPServer) ResetPassword(c *models.ReqContext) response.Response {
	form := dtos.ResetUserPasswordForm{}
	if err := web.Bind(c.Req, &form); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	query := models.ValidateResetPasswordCodeQuery{Code: form.Code}

	getUserByLogin := func(ctx context.Context, login string) (*models.User, error) {
		userQuery := models.GetUserByLoginQuery{LoginOrEmail: login}
		err := hs.SQLStore.GetUserByLogin(ctx, &userQuery)
		return userQuery.Result, err
	}

	if err := hs.NotificationService.ValidateResetPasswordCode(c.Req.Context(), &query, getUserByLogin); err != nil {
		if errors.Is(err, models.ErrInvalidEmailCode) {
			return response.Error(400, "Invalid or expired reset password code", nil)
		}
		return response.Error(500, "Unknown error validating email code", err)
	}

	if form.NewPassword != form.ConfirmPassword {
		return response.Error(400, "Passwords do not match", nil)
	}

	password := models.Password(form.NewPassword)
	if password.IsWeak() {
		return response.Error(400, "New password is too short", nil)
	}

	cmd := models.ChangeUserPasswordCommand{}
	cmd.UserId = query.Result.Id
	var err error
	cmd.NewPassword, err = util.EncodePassword(form.NewPassword, query.Result.Salt)
	if err != nil {
		return response.Error(500, "Failed to encode password", err)
	}

	if err := hs.SQLStore.ChangeUserPassword(c.Req.Context(), &cmd); err != nil {
		return response.Error(500, "Failed to change user password", err)
	}

	return response.Success("User password changed")
}
