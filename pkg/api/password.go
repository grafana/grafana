package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
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

func ViewResetPasswordForm(c *middleware.Context) Response {
	return ApiSuccess("Email sent")
}
