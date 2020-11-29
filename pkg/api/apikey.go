package api

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func GetAPIKeys(c *models.ReqContext) Response {
	query := models.GetApiKeysQuery{OrgId: c.OrgId, IncludeExpired: c.QueryBool("includeExpired")}

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

func (hs *HTTPServer) AddAPIKey(c *models.ReqContext, dtoCmd dtos.AddApiKeyCommand) Response {
	cmd := models.AddApiKeyCommand{
		Name:          dtoCmd.Name,
		Role:          dtoCmd.Role,
		OrgId:         c.OrgId,
		SecondsToLive: dtoCmd.SecondsToLive,
	}
	return hs.addAPIKey(cmd)
}

func (hs *HTTPServer) AddAPIKeyForOrg(c *models.ReqContext, dtoCmd dtos.AddApiKeyForOrgCommand) Response {
	cmd := models.AddApiKeyCommand{
		Name:          dtoCmd.Name,
		Role:          dtoCmd.Role,
		OrgId:         dtoCmd.OrgId,
		SecondsToLive: dtoCmd.SecondsToLive,
	}
	return hs.addAPIKey(cmd)
}

func (hs *HTTPServer) addAPIKey(cmd models.AddApiKeyCommand) Response {
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

	if err := bus.Dispatch(&cmd); err != nil {
		if errors.Is(err, models.ErrInvalidApiKeyExpiration) {
			return Error(400, err.Error(), nil)
		}
		if errors.Is(err, models.ErrDuplicateApiKey) {
			return Error(409, err.Error(), nil)
		}
		return Error(500, "Failed to add API Key", err)
	}

	result := &dtos.NewApiKeyResult{
		ID:   cmd.Result.Id,
		Name: cmd.Result.Name,
		Key:  cmd.Result.Key,
	}

	return JSON(200, result)
}
