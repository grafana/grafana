package api

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/apikey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

// swagger:route GET /auth/keys api_keys getAPIkeys
//
// Get auth keys.
//
// Will return auth keys.
//
// Deprecated: true.
//
// Deprecated. Please use GET /api/serviceaccounts and GET /api/serviceaccounts/{id}/tokens instead
// see https://grafana.com/docs/grafana/next/administration/service-accounts/migrate-api-keys/.
//
// Responses:
// 200: getAPIkeyResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetAPIKeys(c *contextmodel.ReqContext) response.Response {
	query := apikey.GetApiKeysQuery{OrgID: c.GetOrgID(), User: c.SignedInUser, IncludeExpired: c.QueryBool("includeExpired")}

	keys, err := hs.apiKeyService.GetAPIKeys(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to list api keys", err)
	}

	ids := map[string]bool{}
	result := make([]*dtos.ApiKeyDTO, len(keys))
	for i, t := range keys {
		ids[strconv.FormatInt(t.ID, 10)] = true
		var expiration *time.Time = nil
		if t.Expires != nil {
			v := time.Unix(*t.Expires, 0)
			expiration = &v
		}
		result[i] = &dtos.ApiKeyDTO{
			ID:         t.ID,
			Name:       t.Name,
			Role:       t.Role,
			Expiration: expiration,
			LastUsedAt: t.LastUsedAt,
		}
	}

	metadata := getMultiAccessControlMetadata(c, "apikeys:id", ids)
	if len(metadata) > 0 {
		for _, key := range result {
			key.AccessControl = metadata[strconv.FormatInt(key.ID, 10)]
		}
	}

	return response.JSON(http.StatusOK, result)
}

// swagger:route DELETE /auth/keys/{id} api_keys deleteAPIkey
//
// Delete API key.
//
// Deletes an API key.
// Deprecated. See: https://grafana.com/docs/grafana/next/administration/service-accounts/migrate-api-keys/.
//
// Deprecated: true
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) DeleteAPIKey(c *contextmodel.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	cmd := &apikey.DeleteCommand{ID: id, OrgID: c.GetOrgID()}
	err = hs.apiKeyService.DeleteApiKey(c.Req.Context(), cmd)
	if err != nil {
		var status int
		if errors.Is(err, apikey.ErrNotFound) {
			status = http.StatusNotFound
		} else {
			status = http.StatusInternalServerError
		}
		return response.Error(status, "Failed to delete API key", err)
	}

	return response.Success("API key deleted")
}

// swagger:route POST /auth/keys api_keys addAPIkey
//
// Creates an API key.
//
// Will return details of the created API key.
//
// Deprecated: true
// Deprecated. Please use POST /api/serviceaccounts and POST /api/serviceaccounts/{id}/tokens
//
// see: https://grafana.com/docs/grafana/next/administration/service-accounts/migrate-api-keys/.
//
// Responses:
// 410: goneError
func (hs *HTTPServer) AddAPIKey(c *contextmodel.ReqContext) response.Response {
	hs.log.Warn("Obsolete and Permanently moved API endpoint called", "path", c.Req.URL.Path)

	// Respond with a 410 Gone status code
	return response.Error(
		http.StatusGone,
		"this endpoint has been removed, please use POST /api/serviceaccounts and POST /api/serviceaccounts/{id}/tokens instead",
		nil,
	)
}

// swagger:parameters getAPIkeys
type GetAPIkeysParams struct {
	// Show expired keys
	// in:query
	// required:false
	// default:false
	IncludeExpired bool `json:"includeExpired"`
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
