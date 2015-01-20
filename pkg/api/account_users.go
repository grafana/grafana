package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
)

func AddAccountUser(c *middleware.Context, cmd m.AddAccountUserCommand) {
	if !cmd.Role.IsValid() {
		c.JsonApiErr(400, "Invalid role specified", nil)
		return
	}

	userQuery := m.GetUserByLoginQuery{LoginOrEmail: cmd.LoginOrEmail}
	err := bus.Dispatch(&userQuery)
	if err != nil {
		c.JsonApiErr(404, "User not found", nil)
		return
	}

	userToAdd := userQuery.Result

	if userToAdd.Id == c.UserId {
		c.JsonApiErr(400, "Cannot add yourself as user", nil)
		return
	}

	cmd.AccountId = c.AccountId
	cmd.UserId = userToAdd.Id

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Could not add user to account", err)
		return
	}

	c.JsonOK("User added to account")
}

func GetAccountUsers(c *middleware.Context) {
	query := m.GetAccountUsersQuery{AccountId: c.AccountId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to get account user", err)
		return
	}

	c.JSON(200, query.Result)
}

func RemoveAccountUser(c *middleware.Context) {
	userId := c.ParamsInt64(":id")

	cmd := m.RemoveAccountUserCommand{AccountId: c.AccountId, UserId: userId}

	if err := bus.Dispatch(&cmd); err != nil {
		if err == m.ErrLastAccountAdmin {
			c.JsonApiErr(400, "Cannot remove last account admin", nil)
			return
		}
		c.JsonApiErr(500, "Failed to remove user from account", err)
	}

	c.JsonOK("User removed from account")
}
