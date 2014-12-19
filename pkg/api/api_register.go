package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func CreateAccount(c *middleware.Context) {
	var cmd m.CreateAccountCommand

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Validation error", nil)
		return
	}

	cmd.Login = cmd.Email
	err := bus.Dispatch(&cmd)

	if err != nil {
		c.JsonApiErr(500, "failed to create account", err)
		return
	}

	c.JsonOK("Account created")
}
