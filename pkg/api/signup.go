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
func SignUp(c *middleware.Context, cmd m.CreateUserCommand) {
	if !setting.AllowUserSignUp {
		c.JsonApiErr(401, "User signup is disabled", nil)
		return
	}

	cmd.Login = cmd.Email

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "failed to create user", err)
		return
	}

	user := cmd.Result

	bus.Publish(&events.UserSignedUp{
		Id:    user.Id,
		Name:  user.Name,
		Email: user.Email,
		Login: user.Login,
	})

	loginUserWithUser(&user, c)

	c.JsonOK("User created and logged in")

	metrics.M_Api_User_SignUp.Inc(1)
}
