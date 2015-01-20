package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func CreateAccount(c *middleware.Context, cmd m.CreateAccountCommand) {
	cmd.UserId = c.UserId

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to create account", nil)
		return
	}

	c.JsonOK("Account created")
}
