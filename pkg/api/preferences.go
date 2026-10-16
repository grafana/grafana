package api

import (
	"net/http"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	prefutils "github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
	"github.com/open-feature/go-sdk/openfeature"
)

var ofClient = openfeature.NewDefaultClient()

// swagger:route GET /user/preferences signed_in_user preferences getUserPreferences
//
// Get user preferences.
//
// Use /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/user-{uid}
//
// Deprecated: true
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetUserPreferences(c *contextmodel.ReqContext) response.Response {
	return hs.preferenceK8sHandler.GetPreferences(c, prefutils.UserOwner(c.GetIdentifier()))
}

// swagger:route PUT /user/preferences signed_in_user preferences updateUserPreferences
//
// Update user preferences.
//
// Use /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/user-{uid}
//
// Deprecated: true
//
// Omitting a key (`theme`, `homeDashboardUID`, `timezone`) will cause the current value to be replaced with the system default value.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) UpdateUserPreferences(c *contextmodel.ReqContext) response.Response {
	dtoCmd := dtos.UpdatePrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	return hs.preferenceK8sHandler.UpdatePreferences(c, prefutils.UserOwner(c.GetIdentifier()), &dtoCmd)
}

// swagger:route PATCH /user/preferences signed_in_user preferences patchUserPreferences
//
// Patch user preferences.
//
// Use /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/user-{uid}
//
// Deprecated: true
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) PatchUserPreferences(c *contextmodel.ReqContext) response.Response {
	dtoCmd := dtos.PatchPrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	return hs.preferenceK8sHandler.PatchPreferences(c, prefutils.UserOwner(c.GetIdentifier()), &dtoCmd)
}

// swagger:route GET /org/preferences org preferences getOrgPreferences
//
// Get Current Org Prefs.
//
// Use /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/namespace
//
// Deprecated: true
//
// Responses:
// 200: getPreferencesResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetOrgPreferences(c *contextmodel.ReqContext) response.Response {
	return hs.preferenceK8sHandler.GetPreferences(c, prefutils.NamespaceOwner())
}

// swagger:route PUT /org/preferences org preferences updateOrgPreferences
//
// Update Current Org Prefs.
//
// Use /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/namespace
//
// Deprecated: true
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) UpdateOrgPreferences(c *contextmodel.ReqContext) response.Response {
	dtoCmd := dtos.UpdatePrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	return hs.preferenceK8sHandler.UpdatePreferences(c, prefutils.NamespaceOwner(), &dtoCmd)
}

// swagger:route PATCH /org/preferences org preferences patchOrgPreferences
//
// Patch Current Org Prefs.
//
// Use /apis/preferences.grafana.app/v1/namespaces/{namespace}/preferences/namespace
//
// Deprecated: true
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) PatchOrgPreferences(c *contextmodel.ReqContext) response.Response {
	dtoCmd := dtos.PatchPrefsCmd{}
	if err := web.Bind(c.Req, &dtoCmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	return hs.preferenceK8sHandler.PatchPreferences(c, prefutils.NamespaceOwner(), &dtoCmd)
}

// swagger:parameters  updateUserPreferences
type UpdateUserPreferencesParams struct {
	// in:body
	// required:true
	Body dtos.UpdatePrefsCmd `json:"body"`
}

// swagger:parameters updateOrgPreferences
type UpdateOrgPreferencesParams struct {
	// in:body
	// required:true
	Body dtos.UpdatePrefsCmd `json:"body"`
}

// swagger:response getPreferencesResponse
type GetPreferencesResponse struct {
	// in:body
	Body preferences.PreferencesSpec `json:"body"`
}

// swagger:parameters patchUserPreferences
type PatchUserPreferencesParams struct {
	// in:body
	// required:true
	Body dtos.PatchPrefsCmd `json:"body"`
}

// swagger:parameters patchOrgPreferences
type PatchOrgPreferencesParams struct {
	// in:body
	// required:true
	Body dtos.PatchPrefsCmd `json:"body"`
}
