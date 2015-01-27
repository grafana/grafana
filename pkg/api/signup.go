package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

// POST /api/user/signup
func SignUp(c *middleware.Context, cmd m.CreateUserCommand) {

	cmd.Login = cmd.Email

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "failed to create user", err)
		return
	}

	user := cmd.Result

	loginUserWithUser(&user, c)

	c.JsonOK("User created and logged in")
}
