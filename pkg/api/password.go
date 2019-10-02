package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func SendResetPasswordEmail(c *m.ReqContext, form dtos.SendResetPasswordEmailForm) Response {
	if setting.LDAPEnabled || setting.AuthProxyEnabled {
		return Error(401, "Not allowed to reset password when LDAP or Auth Proxy is enabled", nil)
	}
	if setting.DisableLoginForm {
		return Error(401, "Not allowed to reset password when login form is disabled", nil)
	}

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: form.UserOrEmail}

	if err := bus.Dispatch(&userQuery); err != nil {
		c.Logger.Info("Requested password reset for user that was not found", "user", userQuery.LoginOrEmail)
		return Error(200, "Email sent", err)
	}

	emailCmd := m.SendResetPasswordEmailCommand{User: userQuery.Result}
	if err := bus.Dispatch(&emailCmd); err != nil {
		return Error(500, "Failed to send email", err)
	}

	return Success("Email sent")
}

func ResetPassword(c *m.ReqContext, form dtos.ResetUserPasswordForm) Response {
	query := m.ValidateResetPasswordCodeQuery{Code: form.Code}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrInvalidEmailCode {
			return Error(400, "Invalid or expired reset password code", nil)
		}
		return Error(500, "Unknown error validating email code", err)
	}

	if form.NewPassword != form.ConfirmPassword {
		return Error(400, "Passwords do not match", nil)
	}

	cmd := m.ChangeUserPasswordCommand{}
	cmd.UserId = query.Result.Id
	cmd.NewPassword = util.EncodePassword(form.NewPassword, query.Result.Salt)

	if err := bus.Dispatch(&cmd); err != nil {
		return Error(500, "Failed to change user password", err)
	}

	return Success("User password changed")
}
