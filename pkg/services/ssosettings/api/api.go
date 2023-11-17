package api

import (
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

	return response.JSON(http.StatusOK, settings)
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

func (api *Api) removeProviderSettings(c *contextmodel.ReqContext) response.Response {
	key, ok := web.Params(c.Req)[":key"]
	if !ok {
		return response.Error(http.StatusBadRequest, "Missing key", nil)
	}

	err := api.SSOSettingsService.Delete(c.Req.Context(), key)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete provider settings", err)
	}

	return response.JSON(http.StatusNoContent, nil)
}
