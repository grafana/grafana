package api

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func GetUser(c *middleware.Context) {
	query := m.GetUserInfoQuery{UserId: c.UserId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to get account", err)
		return
	}

	c.JSON(200, query.Result)
}

func UpdateUser(c *middleware.Context, cmd m.UpdateUserCommand) {
	cmd.UserId = c.UserId

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(400, "Failed to update account", err)
		return
	}

	c.JsonOK("Account updated")
}

func GetUserAccounts(c *middleware.Context) {
	query := m.GetUserAccountsQuery{UserId: c.UserId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to get user accounts", err)
		return
	}

	for _, ac := range query.Result {
		if ac.AccountId == c.AccountId {
			ac.IsUsing = true
			break
		}
	}

	c.JSON(200, query.Result)
}

func validateUsingAccount(userId int64, accountId int64) bool {
	query := m.GetUserAccountsQuery{UserId: userId}

	if err := bus.Dispatch(&query); err != nil {
		return false
	}

	// validate that the account id in the list
	valid := false
	for _, other := range query.Result {
		if other.AccountId == accountId {
			valid = true
		}
	}

	return valid
}

func SetUsingAccount(c *middleware.Context) {
	usingAccountId := c.ParamsInt64(":id")

	if !validateUsingAccount(c.UserId, usingAccountId) {
		c.JsonApiErr(401, "Not a valid account", nil)
		return
	}

	cmd := m.SetUsingAccountCommand{
		UserId:    c.UserId,
		AccountId: usingAccountId,
	}

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed change active account", err)
		return
	}

	c.JsonOK("Active account changed")
}

func ChangeUserPassword(c *middleware.Context, cmd m.ChangeUserPasswordCommand) {
	userQuery := m.GetUserByIdQuery{Id: c.UserId}

	if err := bus.Dispatch(&userQuery); err != nil {
		c.JsonApiErr(500, "Could not read user from database", err)
		return
	}

	passwordHashed := util.EncodePassword(cmd.OldPassword, userQuery.Result.Salt)
	if passwordHashed != userQuery.Result.Password {
		c.JsonApiErr(401, "Invalid old password", nil)
		return
	}

	if len(cmd.NewPassword) < 4 {
		c.JsonApiErr(400, "New password too short", nil)
		return
	}

	cmd.UserId = c.UserId
	cmd.NewPassword = util.EncodePassword(cmd.NewPassword, userQuery.Result.Salt)

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to change user password", err)
		return
	}

	c.JsonOK("User password changed")
}
