package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

// POST /api/user/signup
func SignUp(c *middleware.Context, cmd m.CreateUserCommand) Response {
	if !setting.AllowUserSignUp {
		return ApiError(401, "User signup is disabled", nil)
	}

	cmd.Login = cmd.Email

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "failed to create user", err)
	}

	user := cmd.Result

	bus.Publish(&events.UserSignedUp{
		Id:    user.Id,
		Name:  user.Name,
		Email: user.Email,
		Login: user.Login,
	})

	loginUserWithUser(&user, c)

	metrics.M_Api_User_SignUp.Inc(1)

	return ApiSuccess("User created and logged in")
}
