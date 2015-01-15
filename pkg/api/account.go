package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func GetAccount(c *middleware.Context) {
	query := m.GetAccountInfoQuery{Id: c.UserAccount.Id}
	err := bus.Dispatch(&query)

	if err != nil {
		c.JsonApiErr(500, "Failed to fetch collaboratos", err)
		return
	}

	c.JSON(200, query.Result)
}

func UpdateAccount(c *middleware.Context) {
	cmd := m.UpdateAccountCommand{}

	if !c.JsonBody(&cmd) {
		c.JsonApiErr(400, "Invalid request", nil)
		return
	}

	cmd.AccountId = c.UserAccount.Id

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(400, "Failed to update account", nil)
		return
	}

	c.JsonOK("Account updated")
}

func GetOtherAccounts(c *middleware.Context) {
	query := m.GetOtherAccountsQuery{AccountId: c.UserAccount.Id}
	err := bus.Dispatch(&query)

	if err != nil {
		c.JsonApiErr(500, "Failed to get other accounts", err)
		return
	}

	result := append(query.Result, &m.OtherAccountDTO{
		AccountId: c.UserAccount.Id,
		Role:      "owner",
		Email:     c.UserAccount.Email,
	})

	for _, ac := range result {
		if ac.AccountId == c.UserAccount.UsingAccountId {
			ac.IsUsing = true
			break
		}
	}

	c.JSON(200, result)
}

func validateUsingAccount(accountId int64, otherId int64) bool {
	if accountId == otherId {
		return true
	}

	query := m.GetOtherAccountsQuery{AccountId: accountId}
	err := bus.Dispatch(&query)
	if err != nil {
		return false
	}

	// validate that the account id in the list
	valid := false
	for _, other := range query.Result {
		if other.AccountId == otherId {
			valid = true
		}
	}
	return valid
}

func SetUsingAccount(c *middleware.Context) {
	usingAccountId := c.ParamsInt64(":id")

	if !validateUsingAccount(c.UserAccount.Id, usingAccountId) {
		c.JsonApiErr(401, "Not a valid account", nil)
		return
	}

	cmd := m.SetUsingAccountCommand{
		AccountId:      c.UserAccount.Id,
		UsingAccountId: usingAccountId,
	}

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to update account", err)
		return
	}

	c.JsonOK("Active account changed")
}
