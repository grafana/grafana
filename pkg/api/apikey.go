package api

import (
	"github.com/Cepave/grafana/pkg/api/dtos"
	"github.com/Cepave/grafana/pkg/bus"
	"github.com/Cepave/grafana/pkg/components/apikeygen"
	"github.com/Cepave/grafana/pkg/middleware"
	m "github.com/Cepave/grafana/pkg/models"
)

func GetApiKeys(c *middleware.Context) Response {
	query := m.GetApiKeysQuery{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		return ApiError(500, "Failed to list api keys", err)
	}

	result := make([]*m.ApiKeyDTO, len(query.Result))
	for i, t := range query.Result {
		result[i] = &m.ApiKeyDTO{
			Id:   t.Id,
			Name: t.Name,
			Role: t.Role,
		}
	}

	return Json(200, result)
}

func DeleteApiKey(c *middleware.Context) Response {
	id := c.ParamsInt64(":id")

	cmd := &m.DeleteApiKeyCommand{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(cmd)
	if err != nil {
		return ApiError(500, "Failed to delete API key", err)
	}

	return ApiSuccess("API key deleted")
}

func AddApiKey(c *middleware.Context, cmd m.AddApiKeyCommand) Response {
	if !cmd.Role.IsValid() {
		return ApiError(400, "Invalid role specified", nil)
	}

	cmd.OrgId = c.OrgId

	newKeyInfo := apikeygen.New(cmd.OrgId, cmd.Name)
	cmd.Key = newKeyInfo.HashedKey

	if err := bus.Dispatch(&cmd); err != nil {
		return ApiError(500, "Failed to add API key", err)
	}

	result := &dtos.NewApiKeyResult{
		Name: cmd.Result.Name,
		Key:  newKeyInfo.ClientSecret}

	return Json(200, result)
}
