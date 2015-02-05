package api

import (
	"github.com/torkelo/grafana-pro/pkg/bus"
	"github.com/torkelo/grafana-pro/pkg/middleware"
	m "github.com/torkelo/grafana-pro/pkg/models"
	"github.com/torkelo/grafana-pro/pkg/util"
)

func GetApiKeys(c *middleware.Context) {
	query := m.GetApiKeysQuery{AccountId: c.AccountId}

	if err := bus.Dispatch(&query); err != nil {
		c.JsonApiErr(500, "Failed to list api keys", err)
		return
	}

	result := make([]*m.ApiKeyDTO, len(query.Result))
	for i, t := range query.Result {
		result[i] = &m.ApiKeyDTO{
			Id:   t.Id,
			Name: t.Name,
			Role: t.Role,
			Key:  t.Key,
		}
	}
	c.JSON(200, result)
}

func DeleteApiKey(c *middleware.Context) {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteApiKeyCommand{Id: id, AccountId: c.AccountId}

	err := bus.Dispatch(cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to delete API key", err)
		return
	}

	c.JsonOK("API key deleted")
}

func AddApiKey(c *middleware.Context, cmd m.AddApiKeyCommand) {
	if !cmd.Role.IsValid() {
		c.JsonApiErr(400, "Invalid role specified", nil)
		return
	}

	cmd.AccountId = c.AccountId
	cmd.Key = util.GetRandomString(64)

	if err := bus.Dispatch(&cmd); err != nil {
		c.JsonApiErr(500, "Failed to add API key", err)
		return
	}

	result := &m.ApiKeyDTO{
		Id:   cmd.Result.Id,
		Name: cmd.Result.Name,
		Role: cmd.Result.Role,
		Key:  cmd.Result.Key,
	}

	c.JSON(200, result)
}

func UpdateApiKey(c *middleware.Context, cmd m.UpdateApiKeyCommand) {
	if !cmd.Role.IsValid() {
		c.JsonApiErr(400, "Invalid role specified", nil)
		return
	}

	cmd.AccountId = c.AccountId

	err := bus.Dispatch(&cmd)
	if err != nil {
		c.JsonApiErr(500, "Failed to update api key", err)
		return
	}

	c.JsonOK("API key updated")
}
