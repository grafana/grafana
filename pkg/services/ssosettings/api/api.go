package api

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	Features           featuremgmt.FeatureToggles
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

// generateFNVETag computes a FNV hash-based ETag for the SSOSettings struct
func generateFNVETag(input any) (string, error) {
	hasher := fnv.New64()
	data, err := json.Marshal(input)
	if err != nil {
		return "", err
	}

	_, err = hasher.Write(data)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", hasher.Sum(nil)), nil
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

// swagger:route GET /v1/sso-settings sso_settings listAllProvidersSettings
//
// # List all SSO Settings entries
//
// You need to have a permission with action `settings:read` with scope `settings:auth.<provider>:*`.
//
// Responses:
// 200: listSSOSettingsResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
func (api *Api) listAllProvidersSettings(c *contextmodel.ReqContext) response.Response {
	providers, err := api.getAuthorizedList(c.Req.Context(), c.SignedInUser)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to list all providers settings", err)
	}

	return response.JSON(http.StatusOK, providers)
}

func (api *Api) getAuthorizedList(ctx context.Context, identity identity.Requester) ([]*models.SSOSettings, error) {
	allProviders, err := api.SSOSettingsService.ListWithRedactedSecrets(ctx)
	if err != nil {
		return nil, err
	}

	authorizedProviders := make([]*models.SSOSettings, 0, len(allProviders))
	for _, provider := range allProviders {
		ev := ac.EvalPermission(ac.ActionSettingsRead, ac.Scope("settings", "auth."+provider.Provider, "*"))
		hasAccess, err := api.AccessControl.Evaluate(ctx, identity, ev)
		if err != nil {
			api.Log.FromContext(ctx).Error("Failed to evaluate permissions", "error", err)
			return nil, err
		}

		if !hasAccess {
			continue
		}

		authorizedProviders = append(authorizedProviders, provider)
	}

	return authorizedProviders, nil
}

// swagger:route GET /v1/sso-settings/{key} sso_settings getProviderSettings
//
// # Get an SSO Settings entry by Key
//
// You need to have a permission with action `settings:read` with scope `settings:auth.<provider>:*`.
//
// Responses:
// 200: getSSOSettingsResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
func (api *Api) getProviderSettings(c *contextmodel.ReqContext) response.Response {
	key, ok := web.Params(c.Req)[":key"]
	if !ok {
		return response.Error(http.StatusBadRequest, "Missing key", nil)
	}

	provider, err := api.SSOSettingsService.GetForProviderWithRedactedSecrets(c.Req.Context(), key)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to get provider settings", err)
	}

	etag, err := generateFNVETag(provider)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get provider settings", err)
	}

	return response.JSON(http.StatusOK, provider).SetHeader("ETag", etag)
}

// swagger:route PUT /v1/sso-settings/{key} sso_settings updateProviderSettings
//
// # Update SSO Settings
//
// Inserts or updates the SSO Settings for a provider.
//
// You need to have a permission with action `settings:write` and scope `settings:auth.<provider>:*`.
//
// Responses:
// 204: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (api *Api) updateProviderSettings(c *contextmodel.ReqContext) response.Response {
	key, ok := web.Params(c.Req)[":key"]
	if !ok {
		return response.Error(http.StatusBadRequest, "Missing key", nil)
	}

	var settings models.SSOSettings
	if err := web.Bind(c.Req, &settings); err != nil {
		return response.Error(http.StatusBadRequest, "Failed to parse request body", err)
	}

	settings.Provider = key

	err := api.SSOSettingsService.Upsert(c.Req.Context(), &settings, c.SignedInUser)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to update provider settings", err)
	}

	return response.Empty(http.StatusNoContent)
}

// swagger:route DELETE /v1/sso-settings/{key} sso_settings removeProviderSettings
//
// # Remove SSO Settings
//
// Removes the SSO Settings for a provider.
//
// You need to have a permission with action `settings:write` and scope `settings:auth.<provider>:*`.
//
// Responses:
// 204: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (api *Api) removeProviderSettings(c *contextmodel.ReqContext) response.Response {
	key, ok := web.Params(c.Req)[":key"]
	if !ok {
		return response.Error(http.StatusBadRequest, "Missing key", nil)
	}

	err := api.SSOSettingsService.Delete(c.Req.Context(), key)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to delete provider settings", err)
	}

	return response.Empty(http.StatusNoContent)
}

// swagger:parameters listAllProvidersSettings
type ListAllProvidersSettingsParams struct {
}

// swagger:parameters getProviderSettings
type GetProviderSettingsParams struct {
	// in:path
	// required:true
	Provider string `json:"key"`
}

// swagger:parameters updateProviderSettings
type UpdateProviderSettingsParams struct {
	// in:path
	// required:true
	Provider string `json:"key"`
	// in:body
	// required:true
	Body struct {
		ID       string         `json:"id"`
		Provider string         `json:"provider"`
		Settings map[string]any `json:"settings"`
	} `json:"body"`
}

// swagger:parameters removeProviderSettings
type RemoveProviderSettingsParams struct {
	// in:path
	// required:true
	Provider string `json:"key"`
}

// swagger:response listSSOSettingsResponse
type ListSSOSettingsResponse struct {
	// in: body
	Body []struct {
		ID       string         `json:"id"`
		Provider string         `json:"provider"`
		Settings map[string]any `json:"settings"`
		Source   string         `json:"source"`
	} `json:"body"`
}

// swagger:response getSSOSettingsResponse
type GetSSOSettingsResponse struct {
	// in: body
	Body struct {
		ID       string         `json:"id"`
		Provider string         `json:"provider"`
		Settings map[string]any `json:"settings"`
		Source   string         `json:"source"`
	} `json:"body"`
}
