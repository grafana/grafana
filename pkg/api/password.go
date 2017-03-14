package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func SendResetPasswordEmail(c *middleware.Context, form dtos.SendResetPasswordEmailForm) Response {
	userQuery := m.GetUserByLoginQuery{LoginOrEmail: form.UserOrEmail}

	if err := bus.Dispatch(&userQuery); err != nil {
		return ApiError(404, "User does not exist", err)
	}

	emailCmd := m.SendResetPasswordEmailCommand{User: userQuery.Result}
	if err := bus.Dispatch(&emailCmd); err != nil {
		return ApiError(500, "Failed to send email", err)
	}

	return ApiSuccess("Email sent")
}

func ResetPassword(c *middleware.Context, form dtos.ResetUserPasswordForm) Response {
	query := m.ValidateResetPasswordCodeQuery{Code: form.Code}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrInvalidEmailCode {
			return ApiError(400, "Invalid or expired reset password code", nil)
		}
		return ApiError(500, "Unknown error validating email code", err)
	}

	if form.NewPassword != form.ConfirmPassword {
		return ApiError(400, "Passwords do not match", nil)
	}

	cmd := m.ChangeUserPasswordCommand{}
	cmd.UserId = query.Result.Id
	cmd.NewPassword = util.EncodePassword(form.NewPassword, query.Result.Salt)

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to change user password", err)
	}

	return ApiSuccess("User password changed")
}
