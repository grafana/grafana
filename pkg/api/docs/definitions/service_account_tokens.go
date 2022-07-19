package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/api"
)

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

// swagger:route POST /serviceaccounts/{serviceAccountId}/tokens service_accounts createToken
//
// Create service account tokens
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

// swagger:route DELETE /serviceaccounts/{serviceAccountId}/tokens/{tokenId} service_accounts deleteToken
//
// Delete service account tokens
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
	Body *api.TokenDTO
}

// swagger:response createTokenResponse
type CreateTokenResponse struct {
	// in:body
	Body *dtos.NewApiKeyResult
}
