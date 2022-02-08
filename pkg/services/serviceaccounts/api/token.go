package api

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/web"
)

const failedToDeleteMsg = "Failed to delete API key"

func (api *ServiceAccountsAPI) ListTokens(ctx *models.ReqContext) response.Response {
	saID, err := strconv.ParseInt(web.Params(ctx.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "serviceAccountId is invalid", err)
	}

	if saTokens, err := api.store.ListTokens(ctx.Req.Context(), ctx.OrgId, saID); err == nil {
		result := make([]*models.ApiKeyDTO, len(saTokens))
		for i, t := range saTokens {
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
	} else {
		return response.Error(500, "Internal server error", err)
	}
}

// CreateNewToken adds an API key to a service account
func (api *ServiceAccountsAPI) CreateToken(c *models.ReqContext) response.Response {
	saID, err := strconv.ParseInt(web.Params(c.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "serviceAccountId is invalid", err)
	}

	// confirm service account exists
	if _, err := api.store.RetrieveServiceAccount(c.Req.Context(), c.OrgId, saID); err != nil {
		switch {
		case errors.Is(err, serviceaccounts.ErrServiceAccountNotFound):
			return response.Error(http.StatusNotFound, "Failed to retrieve service account", err)
		default:
			return response.Error(http.StatusInternalServerError, "Failed to retrieve service account", err)
		}
	}

	cmd := models.AddApiKeyCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	// Force affected service account to be the one referenced in the URL
	cmd.ServiceAccountId = &saID
	cmd.OrgId = c.OrgId

	if !cmd.Role.IsValid() {
		return response.Error(400, "Invalid role specified", nil)
	}

	if api.cfg.ApiKeyMaxSecondsToLive != -1 {
		if cmd.SecondsToLive == 0 {
			return response.Error(400, "Number of seconds before expiration should be set", nil)
		}
		if cmd.SecondsToLive > api.cfg.ApiKeyMaxSecondsToLive {
			return response.Error(400, "Number of seconds before expiration is greater than the global limit", nil)
		}
	}

	newKeyInfo, err := apikeygen.New(cmd.OrgId, cmd.Name)
	if err != nil {
		return response.Error(500, "Generating API key failed", err)
	}

	cmd.Key = newKeyInfo.HashedKey

	if err := api.apiKeyStore.AddAPIKey(c.Req.Context(), &cmd); err != nil {
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

// DeleteToken deletes service account tokens
func (api *ServiceAccountsAPI) DeleteToken(c *models.ReqContext) response.Response {
	saID, err := strconv.ParseInt(web.Params(c.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "serviceAccountId is invalid", err)
	}

	// confirm service account exists
	if _, err := api.store.RetrieveServiceAccount(c.Req.Context(), c.OrgId, saID); err != nil {
		switch {
		case errors.Is(err, serviceaccounts.ErrServiceAccountNotFound):
			return response.Error(http.StatusNotFound, "Failed to retrieve service account", err)
		default:
			return response.Error(http.StatusInternalServerError, "Failed to retrieve service account", err)
		}
	}

	tokenID, err := strconv.ParseInt(web.Params(c.Req)[":tokenId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "serviceAccountId is invalid", err)
	}

	// confirm API key belongs to service account. TODO: refactor get & delete to single call
	cmdGet := &models.GetApiKeyByIdQuery{ApiKeyId: tokenID}
	if err = api.apiKeyStore.GetApiKeyById(c.Req.Context(), cmdGet); err != nil {
		status := 404
		if err != nil && !errors.Is(err, models.ErrApiKeyNotFound) {
			status = 500
		} else {
			err = models.ErrApiKeyNotFound
		}

		return response.Error(status, failedToDeleteMsg, err)
	}

	// verify service account ID matches the URL
	if *cmdGet.Result.ServiceAccountId != saID {
		return response.Error(404, failedToDeleteMsg, err)
	}

	cmdDel := &models.DeleteApiKeyCommand{Id: tokenID, OrgId: c.OrgId}
	if err = api.apiKeyStore.DeleteApiKey(c.Req.Context(), cmdDel); err != nil {
		status := 404
		if err != nil && !errors.Is(err, models.ErrApiKeyNotFound) {
			status = 500
		} else {
			err = models.ErrApiKeyNotFound
		}

		return response.Error(status, failedToDeleteMsg, err)
	}

	return response.Success("API key deleted")
}
