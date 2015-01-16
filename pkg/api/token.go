package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/util"
)

func GetTokens(c *middleware.Context) {
	query := m.GetTokensQuery{AccountId: c.UserAccount.Id}
	err := bus.Dispatch(&query)

	if err != nil {
		c.JsonApiErr(500, "Failed to list tokens", err)
		return
	}
	result := make([]*m.TokenDTO, len(query.Result))
	for i, t := range query.Result {
		result[i] = &m.TokenDTO{
			Id:    t.Id,
			Name:  t.Name,
			Role:  t.Role,
			Token: t.Token,
		}
	}
	c.JSON(200, result)
}

func DeleteToken(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteTokenCommand{Id: id, AccountId: c.UserAccount.Id}

	err := bus.Dispatch(cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to delete token", err)
		return
	}

	c.JsonOK("Token deleted")
}

func AddToken(c *middleware.Context, cmd m.AddTokenCommand) {
	if !cmd.Role.IsValid() {
		c.JsonApiErr(400, "Invalid role specified", nil)
		return
	}

	cmd.AccountId = c.UserAccount.Id
	cmd.Token = util.GetRandomString(64)

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add token", err)
		return
	}

	result := &m.TokenDTO{
		Id:    cmd.Result.Id,
		Name:  cmd.Result.Name,
		Role:  cmd.Result.Role,
		Token: cmd.Result.Token,
	}

	c.JSON(200, result)
}

func UpdateToken(c *middleware.Context, cmd m.UpdateTokenCommand) {
	if !cmd.Role.IsValid() {
		c.JsonApiErr(400, "Invalid role specified", nil)
		return
	}

	cmd.AccountId = c.UserAccount.Id

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to update token", err)
		return
	}

	c.JsonOK("Token updated")
}
