package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/satokengen"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
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
	// example: false
	IsRevoked *bool `json:"isRevoked"`
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
// # Get service account tokens
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
func (api *ServiceAccountsAPI) ListTokens(ctx *contextmodel.ReqContext) response.Response {
	saID, err := strconv.ParseInt(web.Params(ctx.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Service Account ID is invalid", err)
	}

	saTokens, err := api.service.ListTokens(ctx.Req.Context(), &serviceaccounts.GetSATokensQuery{
		OrgID:            &ctx.OrgID,
		ServiceAccountID: &saID,
	})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Internal server error", err)
	}

	result := make([]TokenDTO, len(saTokens))
	for i, t := range saTokens {
		var (
			token                             = t // pin pointer
			expiration             *time.Time = nil
			secondsUntilExpiration float64    = 0
		)

		isExpired := hasExpired(t.Expires)
		if t.Expires != nil {
			v := time.Unix(*t.Expires, 0)
			expiration = &v
			if !isExpired && (*expiration).Before(time.Now().Add(sevenDaysAhead)) {
				secondsUntilExpiration = time.Until(*expiration).Seconds()
			}
		}

		result[i] = TokenDTO{
			Id:                     token.ID,
			Name:                   token.Name,
			Created:                &token.Created,
			Expiration:             expiration,
			SecondsUntilExpiration: &secondsUntilExpiration,
			HasExpired:             isExpired,
			LastUsedAt:             token.LastUsedAt,
			IsRevoked:              token.IsRevoked,
		}
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:route POST /serviceaccounts/{serviceAccountId}/tokens service_accounts createToken
//
// # CreateNewToken adds a token to a service account
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
func (api *ServiceAccountsAPI) CreateToken(c *contextmodel.ReqContext) response.Response {
	saID, err := strconv.ParseInt(web.Params(c.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Service Account ID is invalid", err)
	}

	// confirm service account exists
	if _, err = api.service.RetrieveServiceAccount(c.Req.Context(), c.OrgID, saID); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to retrieve service account", err)
	}

	cmd := serviceaccounts.AddServiceAccountTokenCommand{}
	if err = web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "Bad request data", err)
	}

	// Force affected service account to be the one referenced in the URL
	cmd.OrgId = c.OrgID

	if api.cfg.ApiKeyMaxSecondsToLive != -1 {
		if cmd.SecondsToLive == 0 {
			return response.Error(http.StatusBadRequest, "Number of seconds before expiration should be set", nil)
		}
		if cmd.SecondsToLive > api.cfg.ApiKeyMaxSecondsToLive {
			return response.Error(http.StatusBadRequest, "Number of seconds before expiration is greater than the global limit", nil)
		}
	}

	if api.cfg.SATokenExpirationDayLimit > 0 {
		dayExpireLimit := time.Now().Add(time.Duration(api.cfg.SATokenExpirationDayLimit) * time.Hour * 24).Truncate(24 * time.Hour)
		expirationDate := time.Now().Add(time.Duration(cmd.SecondsToLive) * time.Second).Truncate(24 * time.Hour)
		if expirationDate.After(dayExpireLimit) {
			return response.Respond(http.StatusBadRequest, "The expiration date input exceeds the limit for service account access tokens expiration date")
		}
	}

	newKeyInfo, err := satokengen.New(ServiceID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Generating service account token failed", err)
	}

	cmd.Key = newKeyInfo.HashedKey

	apiKey, err := api.service.AddServiceAccountToken(c.Req.Context(), saID, &cmd)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to add service account token", err)
	}

	result := &dtos.NewApiKeyResult{
		ID:   apiKey.ID,
		Name: apiKey.Name,
		Key:  newKeyInfo.ClientSecret,
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:route DELETE /serviceaccounts/{serviceAccountId}/tokens/{tokenId} service_accounts deleteToken
//
// # DeleteToken deletes service account tokens
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
func (api *ServiceAccountsAPI) DeleteToken(c *contextmodel.ReqContext) response.Response {
	saID, err := strconv.ParseInt(web.Params(c.Req)[":serviceAccountId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Service Account ID is invalid", err)
	}

	// confirm service account exists
	if _, err := api.service.RetrieveServiceAccount(c.Req.Context(), c.OrgID, saID); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to retrieve service account", err)
	}

	tokenID, err := strconv.ParseInt(web.Params(c.Req)[":tokenId"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Token ID is invalid", err)
	}

	if err = api.service.DeleteServiceAccountToken(c.Req.Context(), c.OrgID, saID, tokenID); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, failedToDeleteMsg, err)
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
