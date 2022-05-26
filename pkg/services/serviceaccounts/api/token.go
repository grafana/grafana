package api

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	apikeygenprefix "github.com/grafana/grafana/pkg/components/apikeygenprefixed"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/web"
)

const (
	failedToDeleteMsg = "Failed to delete API key"
	ServiceID         = "sa"
)

type TokenDTO struct {
	Id                     int64      `json:"id"`
	Name                   string     `json:"name"`
	Created                *time.Time `json:"created"`
	Expiration             *time.Time `json:"expiration"`
	SecondsUntilExpiration *float64   `json:"secondsUntilExpiration"`
	HasExpired             bool       `json:"hasExpired"`
}

func hasExpired(expiration *int64) bool {
	if expiration == nil {
		return false
	}
	v := time.Unix(*expiration, 0)
	return (v).Before(time.Now())
}

const sevenDaysAhead = 7 * 24 * time.Hour

func (api *ServiceAccountsAPI) ListTokens(ctx *models.ReqContext) response.Response {
	saID, err := strconv.ParseInt(web.Params(ctx.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Service Account ID is invalid", err)
	}

	if saTokens, err := api.store.ListTokens(ctx.Req.Context(), ctx.OrgId, saID); err == nil {
		result := make([]*TokenDTO, len(saTokens))
		for i, t := range saTokens {
			var expiration *time.Time = nil
			var secondsUntilExpiration float64 = 0

			isExpired := hasExpired(t.Expires)
			if t.Expires != nil {
				v := time.Unix(*t.Expires, 0)
				expiration = &v
				if !isExpired && (*expiration).Before(time.Now().Add(sevenDaysAhead)) {
					secondsUntilExpiration = time.Until(*expiration).Seconds()
				}
			}

			result[i] = &TokenDTO{
				Id:                     t.Id,
				Name:                   t.Name,
				Created:                &t.Created,
				Expiration:             expiration,
				SecondsUntilExpiration: &secondsUntilExpiration,
				HasExpired:             isExpired,
			}
		}

		return response.JSON(http.StatusOK, result)
	} else {
		return response.Error(http.StatusInternalServerError, "Internal server error", err)
	}
}

// CreateNewToken adds an API key to a service account
func (api *ServiceAccountsAPI) CreateToken(c *models.ReqContext) response.Response {
	saID, err := strconv.ParseInt(web.Params(c.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Service Account ID is invalid", err)
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

	cmd := serviceaccounts.AddServiceAccountTokenCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "Bad request data", err)
	}

	// Force affected service account to be the one referenced in the URL
	cmd.OrgId = c.OrgId

	if api.cfg.ApiKeyMaxSecondsToLive != -1 {
		if cmd.SecondsToLive == 0 {
			return response.Error(http.StatusBadRequest, "Number of seconds before expiration should be set", nil)
		}
		if cmd.SecondsToLive > api.cfg.ApiKeyMaxSecondsToLive {
			return response.Error(http.StatusBadRequest, "Number of seconds before expiration is greater than the global limit", nil)
		}
	}

	newKeyInfo, err := apikeygenprefix.New(ServiceID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Generating API key failed", err)
	}

	cmd.Key = newKeyInfo.HashedKey

	if err := api.store.AddServiceAccountToken(c.Req.Context(), saID, &cmd); err != nil {
		if errors.Is(err, models.ErrInvalidApiKeyExpiration) {
			return response.Error(http.StatusBadRequest, err.Error(), nil)
		}
		if errors.Is(err, models.ErrDuplicateApiKey) {
			return response.Error(http.StatusConflict, err.Error(), nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to add API Key", err)
	}

	result := &dtos.NewApiKeyResult{
		ID:   cmd.Result.Id,
		Name: cmd.Result.Name,
		Key:  newKeyInfo.ClientSecret,
	}

	return response.JSON(http.StatusOK, result)
}

// DeleteToken deletes service account tokens
func (api *ServiceAccountsAPI) DeleteToken(c *models.ReqContext) response.Response {
	saID, err := strconv.ParseInt(web.Params(c.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Service Account ID is invalid", err)
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
		return response.Error(http.StatusBadRequest, "Token ID is invalid", err)
	}

	if err = api.store.DeleteServiceAccountToken(c.Req.Context(), c.OrgId, saID, tokenID); err != nil {
		status := http.StatusNotFound
		if err != nil && !errors.Is(err, models.ErrApiKeyNotFound) {
			status = http.StatusInternalServerError
		} else {
			err = models.ErrApiKeyNotFound
		}

		return response.Error(status, failedToDeleteMsg, err)
	}

	return response.Success("API key deleted")
}
