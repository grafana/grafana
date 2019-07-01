package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/models"
	"time"
)

func GetAPIKeys(c *models.ReqContext) Response {
	query := models.GetApiKeysQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		return Error(500, "Failed to list api keys", err)
	}

	result := make([]*models.ApiKeyDTO, len(query.Result))
	for i, t := range query.Result {
		var expiration *time.Time = nil
		if t.Expires != nil {
			v := time.Unix(*t.Expires, 0)
			expiration = &v
		}
		result[i] = &models.ApiKeyDTO{
			Id:         t.Id,
			Name:       t.Name,
			Role:       t.Role,
			Expiration: expiration,
		}
	}

	return JSON(200, result)
}

func DeleteAPIKey(c *models.ReqContext) Response {
	id := c.ParamsInt64(":id")

	cmd := &models.DeleteApiKeyCommand{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(cmd)
	if err != nil {
		return Error(500, "Failed to delete API key", err)
	}

	return Success("API key deleted")
}

func (hs *HTTPServer) AddAPIKey(c *models.ReqContext, cmd models.AddApiKeyCommand) Response {
	if !cmd.Role.IsValid() {
		return Error(400, "Invalid role specified", nil)
	}

	if hs.Cfg.ApiKeyMaxSecondsToLive != -1 {
		if cmd.SecondsToLive == 0 {
			return Error(400, "Number of seconds before expiration should be set", nil)
		}
		if cmd.SecondsToLive > hs.Cfg.ApiKeyMaxSecondsToLive {
			return Error(400, "Number of seconds before expiration is greater than the global limit", nil)
		}
	}
	cmd.OrgId = c.OrgId

	newKeyInfo := apikeygen.New(cmd.OrgId, cmd.Name)
	cmd.Key = newKeyInfo.HashedKey

	if err := bus.Dispatch(&cmd); err != nil {
		if err == models.ErrInvalidApiKeyExpiration {
			return Error(400, err.Error(), nil)
		}
		return Error(500, "Failed to add API key", err)
	}

	result := &dtos.NewApiKeyResult{
		Name: cmd.Result.Name,
		Key:  newKeyInfo.ClientSecret}

	return JSON(200, result)
}
