package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
)

// swagger:route GET /auth/keys api_keys getAPIkeys
//
// Get auth keys.
//
// Will return auth keys.
//
// Responses:
// 200: getAPIkeyResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /auth/keys api_keys addAPIkey
//
// Creates an API key.
//
// Will return details of the created API key
//
// Responses:
// 200: postAPIkeyResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 409: conflictError
// 500: internalServerError

// swagger:route DELETE /auth/keys/{id} api_keys deleteAPIkey
//
// Delete API key.
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:parameters getAPIkeys
type GetAPIkeysParams struct {
	// Show expired keys
	// in:query
	// required:false
	// default:false
	IncludeExpired bool `json:"includeExpired"`
}

// swagger:parameters addAPIkey
type AddAPIkeyParams struct {
	// in:body
	// required:true
	Body models.AddApiKeyCommand
}

// swagger:parameters deleteAPIkey
type DeleteAPIkeyParams struct {
	// in:path
	// required:true
	ID int64 `json:"id"`
}

// swagger:response getAPIkeyResponse
type GetAPIkeyResponse struct {
	// The response message
	// in: body
	Body []*dtos.ApiKeyDTO `json:"body"`
}

// swagger:response postAPIkeyResponse
type PostAPIkeyResponse struct {
	// The response message
	// in: body
	Body dtos.NewApiKeyResult `json:"body"`
}
