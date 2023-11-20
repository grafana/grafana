package api

import (
<<<<<<< HEAD
	"errors"
=======
	"crypto/sha1"
	"encoding/json"
	"fmt"
>>>>>>> c5669dab80 (basic secret removal and etag implementation)
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/web"
)

type Api struct {
	Log                log.Logger
	RouteRegister      routing.RouteRegister
	AccessControl      ac.AccessControl
	Features           *featuremgmt.FeatureManager
	SSOSettingsService ssosettings.Service
}

func ProvideApi(
	ssoSettingsSvc ssosettings.Service,
	routeRegister routing.RouteRegister,
	ac ac.AccessControl,
) *Api {
	api := &Api{
		SSOSettingsService: ssoSettingsSvc,
		RouteRegister:      routeRegister,
		AccessControl:      ac,
		Log:                log.New("ssosettings.api"),
	}

	return api
}

// RegisterAPIEndpoints Registers Endpoints on Grafana Router
func (api *Api) RegisterAPIEndpoints() {
	api.RouteRegister.Group("/api/v1/sso-settings", func(router routing.RouteRegister) {
		auth := ac.Middleware(api.AccessControl)

		scopeKey := ac.Parameter(":key")
		settingsScope := ac.ScopeSettingsOAuth(scopeKey)

		reqWriteAccess := auth(ac.EvalPermission(ac.ActionSettingsWrite, settingsScope))

		router.Get("/", auth(ac.EvalPermission(ac.ActionSettingsRead)), routing.Wrap(api.listAllProvidersSettings))
		router.Get("/:key", auth(ac.EvalPermission(ac.ActionSettingsRead, settingsScope)), routing.Wrap(api.getProviderSettings))
		router.Put("/:key", reqWriteAccess, routing.Wrap(api.updateProviderSettings))
		router.Delete("/:key", reqWriteAccess, routing.Wrap(api.removeProviderSettings))
	})
}

func (api *Api) listAllProvidersSettings(c *contextmodel.ReqContext) response.Response {
	providers, err := api.SSOSettingsService.List(c.Req.Context(), c.SignedInUser)
	if err != nil {
		return response.Error(500, "Failed to get providers", err)
	}

	return response.JSON(http.StatusOK, providers)
}

func (api *Api) getProviderSettings(c *contextmodel.ReqContext) response.Response {
	key, ok := web.Params(c.Req)[":key"]
	if !ok {
		return response.Error(http.StatusBadRequest, "Missing key", nil)
	}

	settings, err := api.SSOSettingsService.GetForProvider(c.Req.Context(), key)
	if err != nil {
		return response.Error(http.StatusNotFound, "The provider was not found", err)
	}

	if c.QueryBool("includeDefaults") {
		return response.JSON(200, settings)
	}

	// colinTODO: remove when defaults for each provider are implemented
	defaults := map[string]interface{}{
		"enabled":                    false,
		"role_attribute_strict":      false,
		"allow_sign_up":              true,
		"name":                       "default name",
		"tls_skip_verify_insecure":   false,
		"use_pkce":                   true,
		"use_refresh_token":          false,
		"allow_assign_grafana_admin": false,
		"auto_login":                 false,
	}

	for key, defaultValue := range defaults {
		if value, exists := settings.Settings[key]; exists && value == defaultValue {
			delete(settings.Settings, key)
		}
	}

	if _, exists := settings.Settings["client_secret"]; exists {
		settings.Settings["client_secret"] = "*********"
	}

	etag := generateSHA1ETag(settings.Settings)

	return response.JSON(200, settings).SetHeader("ETag", etag)
}

func generateSHA1ETag(settings map[string]interface{}) string {
	hasher := sha1.New()
	data, _ := json.Marshal(settings)
	hasher.Write(data)
	return fmt.Sprintf("%x", hasher.Sum(nil))
}

func (api *Api) updateProviderSettings(c *contextmodel.ReqContext) response.Response {
	key, ok := web.Params(c.Req)[":key"]
	if !ok {
		return response.Error(http.StatusBadRequest, "Missing key", nil)
	}

	var newSettings models.SSOSetting
	if err := web.Bind(c.Req, &newSettings); err != nil {
		return response.Error(http.StatusBadRequest, "Failed to parse request body", err)
	}

	err := api.SSOSettingsService.Upsert(c.Req.Context(), key, newSettings.Settings)
	// TODO: first check whether the error is referring to validation errors

	// other error
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update provider settings", err)
	}

	return response.JSON(http.StatusNoContent, nil)
}

// swagger:route DELETE /v1/sso-settings/{key} sso_settings removeProviderSettings
//
// # Remove SSO Settings
//
// # Remove an SSO Settings entry by Key
//
// You need to have a permission with action `settings:write` with scope `settings:auth.<provider>:*`.
//
// Responses:
// 204: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *Api) removeProviderSettings(c *contextmodel.ReqContext) response.Response {
	key, ok := web.Params(c.Req)[":key"]
	if !ok {
		return response.Error(http.StatusBadRequest, "Missing key", nil)
	}

	err := api.SSOSettingsService.Delete(c.Req.Context(), key)
	if err != nil {
		if errors.Is(err, ssosettings.ErrNotFound) {
			return response.Error(http.StatusNotFound, "The provider was not found", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to delete provider settings", err)
	}

	return response.JSON(http.StatusNoContent, nil)
}

// swagger:parameters removeProviderSettings
type RemoveProviderSettingsParams struct {
	// in:path
	// required:true
	Key string `json:"key"`
}
