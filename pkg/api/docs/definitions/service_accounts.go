package definitions

import "github.com/grafana/grafana/pkg/services/serviceaccounts"

// swagger:route GET /serviceaccounts/search service_accounts searchOrgServiceAccountsWithPaging
//
// Search service accounts with Paging
//
// Required permissions (See note in the [introduction](https://grafana.com/docs/grafana/latest/developers/http_api/serviceaccount/#service-account-api) for an explanation):
// action: `serviceaccounts:read` scope: `serviceaccounts:*`
//
// Responses:
// 200: searchOrgServiceAccountsWithPagingResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /serviceaccounts service_accounts createServiceAccount
//
// Create service account
//
// Required permissions (See note in the [introduction](https://grafana.com/docs/grafana/latest/developers/http_api/serviceaccount/#service-account-api) for an explanation):
// action: `serviceaccounts:write` scope: `serviceaccounts:*`
//
// Requires basic authentication and that the authenticated user is a Grafana Admin.
//
// Responses:
// 201: createServiceAccountResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /serviceaccounts/{serviceAccountId} service_accounts retrieveServiceAccount
//
// Get single serviceaccount by Id
//
// Required permissions (See note in the [introduction](https://grafana.com/docs/grafana/latest/developers/http_api/serviceaccount/#service-account-api) for an explanation):
// action: `serviceaccounts:read` scope: `serviceaccounts:id:1` (single service account)
//
// Responses:
// 200: retrieveServiceAccountResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route PATCH /serviceaccounts/{serviceAccountId} service_accounts updateServiceAccount
//
// Update service account
//
// Required permissions (See note in the [introduction](https://grafana.com/docs/grafana/latest/developers/http_api/serviceaccount/#service-account-api) for an explanation):
// action: `serviceaccounts:write` scope: `serviceaccounts:id:1` (single service account)
//
// Responses:
// 200: updateServiceAccountResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route DELETE /serviceaccounts/{serviceAccountId} service_accounts deleteServiceAccount
//
// Delete service account
//
// Required permissions (See note in the [introduction](https://grafana.com/docs/grafana/latest/developers/http_api/serviceaccount/#service-account-api) for an explanation):
// action: `serviceaccounts:delete` scope: `serviceaccounts:id:1` (single service account)
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:parameters searchOrgServiceAccountsWithPaging
type SearchOrgServiceAccountsWithPagingParams struct {
	// in:query
	// required:false
	Disabled bool `jsson:"disabled"`
	// in:query
	// required:false
	ExpiredTokens bool `json:"expiredTokens"`
	// It will return results where the query value is contained in one of the name.
	// Query values with spaces need to be URL encoded.
	// in:query
	// required:false
	Query string `json:"query"`
	// The default value is 1000.
	// in:query
	// required:false
	PerPage int `json:"perpage"`
	// The default value is 1.
	// in:query
	// required:false
	Page int `json:"page"`
}

// swagger:parameters createServiceAccount
type CreateServiceAccountParams struct {
	//in:body
	Body serviceaccounts.CreateServiceAccountForm
}

// swagger:parameters retrieveServiceAccount
type RetrieveServiceAccountParams struct {
	// in:path
	ServiceAccountId int64 `json:"serviceAccountId"`
}

// swagger:parameters updateServiceAccount
type UpdateServiceAccountParams struct {
	// in:path
	ServiceAccountId int64 `json:"serviceAccountId"`
	// in:body
	Body serviceaccounts.UpdateServiceAccountForm
}

// swagger:parameters deleteServiceAccount
type DeleteServiceAccountParams struct {
	// in:path
	ServiceAccountId int64 `json:"serviceAccountId"`
}

// swagger:response searchOrgServiceAccountsWithPagingResponse
type SearchOrgServiceAccountsWithPagingResponse struct {
	// in:body
	Body *serviceaccounts.SearchServiceAccountsResult
}

// swagger:response createServiceAccountResponse
type CreateServiceAccountResponse struct {
	// in:body
	Body *serviceaccounts.ServiceAccountDTO
}

// swagger:response retrieveServiceAccountResponse
type RetrieveServiceAccountResponse struct {
	// in:body
	Body *serviceaccounts.ServiceAccountDTO
}

// swagger:response updateServiceAccountResponse
type UpdateServiceAccountResponse struct {
	// in:body
	Body struct {
		Message        string                                    `json:"message"`
		ID             int64                                     `json:"id"`
		Name           string                                    `json:"name"`
		ServiceAccount *serviceaccounts.ServiceAccountProfileDTO `json:"serviceaccount"`
	}
}
