package api

import (
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/models"
)

// GetAPIKeys returns a list of API keys
func GetAPIKeys(c *models.ReqContext) response.Response {
	query := models.GetApiKeysQuery{OrgId: c.OrgId, IncludeExpired: c.QueryBool("includeExpired")}

	if err := bus.DispatchCtx(c.Req.Context(), &query); err != nil {
		return response.Error(500, "Failed to list api keys", err)
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

	return response.JSON(200, result)
}

// DeleteAPIKey deletes an API key
func DeleteAPIKey(c *models.ReqContext) response.Response {
	id := c.ParamsInt64(":id")

	cmd := &models.DeleteApiKeyCommand{Id: id, OrgId: c.OrgId}

	err := bus.DispatchCtx(c.Req.Context(), cmd)
	if err != nil {
		var status int
		if errors.Is(err, models.ErrApiKeyNotFound) {
			status = 404
		} else {
			status = 500
		}
		return response.Error(status, "Failed to delete API key", err)
	}

	return response.Success("API key deleted")
}

// AddAPIKey adds an API key
func (hs *HTTPServer) AddAPIKey(c *models.ReqContext, cmd models.AddApiKeyCommand) response.Response {
	if !cmd.Role.IsValid() {
		return response.Error(400, "Invalid role specified", nil)
	}

	if hs.Cfg.ApiKeyMaxSecondsToLive != -1 {
		if cmd.SecondsToLive == 0 {
			return response.Error(400, "Number of seconds before expiration should be set", nil)
		}
		if cmd.SecondsToLive > hs.Cfg.ApiKeyMaxSecondsToLive {
			return response.Error(400, "Number of seconds before expiration is greater than the global limit", nil)
		}
	}
	cmd.OrgId = c.OrgId
	var err error
	if hs.Cfg.FeatureToggles["service-accounts"] {
		//Every new API key must have an associated service account
		if cmd.CreateNewServiceAccount {
			//Create a new service account for the new API key
			serviceAccount, err := hs.SQLStore.CloneUserToServiceAccount(c.Req.Context(), c.SignedInUser)
			if err != nil {
				return response.Error(500, "Unable to clone user to service account", err)
			}
			cmd.ServiceAccountId = serviceAccount.Id
		} else {
			//Link the new API key to an existing service account

			//Check if user and service account are in the same org
			query := models.GetUserByIdQuery{Id: cmd.ServiceAccountId}
			err = bus.DispatchCtx(c.Req.Context(), &query)
			if err != nil {
				return response.Error(500, "Unable to clone user to service account", err)
			}
			serviceAccountDetails := query.Result
			if serviceAccountDetails.OrgId != c.OrgId || serviceAccountDetails.OrgId != cmd.OrgId {
				return response.Error(403, "Target service is not in the same organisation as requesting user or api key", err)
			}
		}
	}

	newKeyInfo, err := apikeygen.New(cmd.OrgId, cmd.Name)
	if err != nil {
		return response.Error(500, "Generating API key failed", err)
	}

	cmd.Key = newKeyInfo.HashedKey

	if err := bus.DispatchCtx(c.Req.Context(), &cmd); err != nil {
		if errors.Is(err, models.ErrInvalidApiKeyExpiration) {
			return response.Error(400, err.Error(), nil)
		}
		if errors.Is(err, models.ErrDuplicateApiKey) {
			return response.Error(409, err.Error(), nil)
		}
		return response.Error(500, "Failed to add API Key", err)
	}

	result := &dtos.NewApiKeyResult{
		ID:   cmd.Result.Id,
		Name: cmd.Result.Name,
		Key:  newKeyInfo.ClientSecret,
	}

	return response.JSON(200, result)
}

// AddAPIKey adds an additional API key to a service account
func (hs *HTTPServer) AdditionalAPIKey(c *models.ReqContext, cmd models.AddApiKeyCommand) response.Response {
	if !hs.Cfg.FeatureToggles["service-accounts"] {
		return response.Error(500, "Requires services-accounts feature", errors.New("feature missing"))
	}
	if cmd.CreateNewServiceAccount {
		return response.Error(500, "Can't create service account while adding additional API key", nil)
	}

	return hs.AddAPIKey(c, cmd)
}
