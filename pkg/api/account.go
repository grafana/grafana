package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func GetAccount(c *middleware.Context) {
	query := m.GetAccountByIdQuery{Id: c.AccountId}

	if err := bus.Dispatch(&query); err != nil {
		if err == m.ErrAccountNotFound {
			c.JsonApiErr(404, "Account not found", err)
			return
		}

		c.JsonApiErr(500, "Failed to get account", err)
		return
	}

	account := m.AccountDTO{
		Id:   query.Result.Id,
		Name: query.Result.Name,
	}

	c.JSON(200, &account)
}

func CreateAccount(c *middleware.Context, cmd m.CreateAccountCommand) {
	cmd.UserId = c.UserId

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to create account", err)
		return
	}

	c.JsonOK("Account created")
}

func UpdateAccount(c *middleware.Context, cmd m.UpdateAccountCommand) {
	cmd.AccountId = c.AccountId

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to update account", err)
		return
	}

	c.JsonOK("Account updated")
}
