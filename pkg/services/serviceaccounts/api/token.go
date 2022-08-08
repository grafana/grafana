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
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
	"github.com/grafana/grafana/pkg/web"
)

const (
	failedToDeleteMsg = "Failed to delete service account token"
	ServiceID         = "sa"
)

// swagger:model
type TokenDTO struct {
	// example: 1
	Id int64 `json:"id"`
	// example: grafana
	Name string `json:"name"`
	// example: 2022-03-23T10:31:02Z
	Created *time.Time `json:"created"`
	// example: 2022-03-23T10:31:02Z
	LastUsedAt *time.Time `json:"lastUsedAt"`
	// example: 2022-03-23T10:31:02Z
	Expiration *time.Time `json:"expiration"`
	// example: 0
	SecondsUntilExpiration *float64 `json:"secondsUntilExpiration"`
	// example: false
	HasExpired bool `json:"hasExpired"`
}

func hasExpired(expiration *int64) bool {
	if expiration == nil {
		return false
	}
	v := time.Unix(*expiration, 0)
	return (v).Before(time.Now())
}

const sevenDaysAhead = 7 * 24 * time.Hour

// swagger:route GET /serviceaccounts/{serviceAccountId}/tokens service_accounts listTokens
//
// Get service account tokens
//
// Required permissions (See note in the [introduction](https://grafana.com/docs/grafana/latest/developers/http_api/serviceaccount/#service-account-api) for an explanation):
// action: `serviceaccounts:read` scope: `global:serviceaccounts:id:1` (single service account)
//
// Requires basic authentication and that the authenticated user is a Grafana Admin.
//
// Responses:
// 200: listTokensResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *ServiceAccountsAPI) ListTokens(ctx *models.ReqContext) response.Response {
	saID, err := strconv.ParseInt(web.Params(ctx.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Service Account ID is invalid", err)
	}

	saTokens, err := api.store.ListTokens(ctx.Req.Context(), ctx.OrgId, saID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Internal server error", err)
	}

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
			LastUsedAt:             t.LastUsedAt,
		}
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:route POST /serviceaccounts/{serviceAccountId}/tokens service_accounts createToken
//
// CreateNewToken adds a token to a service account
//
// Required permissions (See note in the [introduction](https://grafana.com/docs/grafana/latest/developers/http_api/serviceaccount/#service-account-api) for an explanation):
// action: `serviceaccounts:write` scope: `serviceaccounts:id:1` (single service account)
//
// Responses:
// 200: createTokenResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 409: conflictError
// 500: internalServerError
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
		return response.Error(http.StatusInternalServerError, "Generating service account token failed", err)
	}

	cmd.Key = newKeyInfo.HashedKey

	if err := api.store.AddServiceAccountToken(c.Req.Context(), saID, &cmd); err != nil {
		if errors.Is(err, database.ErrInvalidTokenExpiration) {
			return response.Error(http.StatusBadRequest, err.Error(), nil)
		}
		if errors.Is(err, database.ErrDuplicateToken) {
			return response.Error(http.StatusConflict, err.Error(), nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to add service account token", err)
	}

	result := &dtos.NewApiKeyResult{
		ID:   cmd.Result.Id,
		Name: cmd.Result.Name,
		Key:  newKeyInfo.ClientSecret,
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:route DELETE /serviceaccounts/{serviceAccountId}/tokens/{tokenId} service_accounts deleteToken
//
// DeleteToken deletes service account tokens
//
// Required permissions (See note in the [introduction](https://grafana.com/docs/grafana/latest/developers/http_api/serviceaccount/#service-account-api) for an explanation):
// action: `serviceaccounts:write` scope: `serviceaccounts:id:1` (single service account)
//
// Requires basic authentication and that the authenticated user is a Grafana Admin.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
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
		if err != nil && !errors.Is(err, apikey.ErrNotFound) {
			status = http.StatusInternalServerError
		} else {
			err = apikey.ErrNotFound
		}

		return response.Error(status, failedToDeleteMsg, err)
	}

	return response.Success("Service account token deleted")
}

// swagger:parameters listTokens
type ListTokensParams struct {
	// in:path
	ServiceAccountId int64 `json:"serviceAccountId"`
}

// swagger:parameters createToken
type CreateTokenParams struct {
	// in:path
	ServiceAccountId int64 `json:"serviceAccountId"`
	// in:body
	Body serviceaccounts.AddServiceAccountTokenCommand
}

// swagger:parameters deleteToken
type DeleteTokenParams struct {
	// in:path
	TokenId int64 `json:"tokenId"`
	// in:path
	ServiceAccountId int64 `json:"serviceAccountId"`
}

// swagger:response listTokensResponse
type ListTokensResponse struct {
	// in:body
	Body *TokenDTO
}

// swagger:response createTokenResponse
type CreateTokenResponse struct {
	// in:body
	Body *dtos.NewApiKeyResult
}
