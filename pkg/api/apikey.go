package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/apikey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

// swagger:route GET /auth/keys api_keys
//
// Get auth keys.
//
// Will return auth keys.
//
// Deprecated: true.
//
// Deprecated. Please use GET /api/serviceaccounts and GET /api/serviceaccounts/{id}/tokens instead
// see https://grafana.com/docs/grafana/next/administration/api-keys/#migrate-api-keys-to-grafana-service-accounts-using-the-api.
//
// Responses:
// 301: statusMovedPermanently
func (hs *HTTPServer) GetAPIKeys(c *contextmodel.ReqContext) response.Response {
	// Set the Location header to the new URL
	c.Context.Resp.Header().Set("Location", "/api/serviceaccounts/tokens")

	// Respond with a 301 Moved Permanently status code
	// the Location header is enough for clients to know where to go next.
	return response.JSON(http.StatusMovedPermanently, nil)
}

// swagger:route DELETE /auth/keys/{id} api_keys
//
// Delete API key.
//
// Deletes an API key.
// Deprecated. See: https://grafana.com/docs/grafana/next/administration/api-keys/#migrate-api-keys-to-grafana-service-accounts-using-the-api.
//
// Deprecated: true
// Responses:
// 301: statusMovedPermanently
func (hs *HTTPServer) DeleteAPIKey(c *contextmodel.ReqContext) response.Response {
	// Set the Location header to the new URL
	c.Context.Resp.Header().Set("Location", "/api/serviceaccounts/tokens")

	// Respond with a 301 Moved Permanently status code
	// the Location header is enough for clients to know where to go next.
	return response.JSON(http.StatusMovedPermanently, nil)
}

// swagger:route POST /auth/keys api_keys
//
// Creates an API key.
//
// Will return details of the created API key.
//
// Deprecated: true
// Deprecated. Please use POST /api/serviceaccounts and POST /api/serviceaccounts/{id}/tokens
//
// see: https://grafana.com/docs/grafana/next/administration/api-keys/#migrate-api-keys-to-grafana-service-accounts-using-the-api.
//
// Responses:
// 301: statusMovedPermanently
func (hs *HTTPServer) AddAPIKey(c *contextmodel.ReqContext) response.Response {
	// Set the Location header to the new URL
	c.Context.Resp.Header().Set("Location", "/api/serviceaccounts/tokens")

	// Respond with a 301 Moved Permanently status code
	// the Location header is enough for clients to know where to go next.
	return response.JSON(http.StatusMovedPermanently, nil)
}

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
	Body apikey.AddCommand
}
