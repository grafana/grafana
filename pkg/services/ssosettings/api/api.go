package api

import (
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
	api.RouteRegister.Group("/api/admin/sso-settings", func(router routing.RouteRegister) {
		auth := ac.Middleware(api.AccessControl)

		scopeKey := ac.Parameter(":key")
		settingsScope := ac.Scope("settings", "auth."+scopeKey, "*")

		reqWriteAccess := auth(ac.EvalAny(
			ac.EvalPermission(ac.ActionSettingsWrite, ac.ScopeSettingsAuth),
			ac.EvalPermission(ac.ActionSettingsWrite, settingsScope)))

		router.Get("/", auth(ac.EvalPermission(ac.ActionSettingsRead, ac.ScopeSettingsAuth)), routing.Wrap(api.GetSettingsForAllProviders))
		router.Get("/:key", auth(ac.EvalPermission(ac.ActionSettingsRead, settingsScope)), routing.Wrap(api.GetSettingsForProvider))
		router.Put("/:key", reqWriteAccess, routing.Wrap(api.UpdateProviderSettings))
		router.Delete("/:key", reqWriteAccess, routing.Wrap(api.RemoveProviderSettings))
	})
}

func (api *Api) GetSettingsForAllProviders(c *contextmodel.ReqContext) response.Response {
	providers, err := api.SSOSettingsService.List(c.Req.Context(), c.SignedInUser)
	if err != nil {
		return response.Error(500, "Failed to get providers", err)
	}

	return response.JSON(200, providers)
}

func (api *Api) GetSettingsForProvider(c *contextmodel.ReqContext) response.Response {
	key, ok := web.Params(c.Req)[":key"]
	if !ok {
		return response.Error(400, "Missing key", nil)
	}

	settings, err := api.SSOSettingsService.GetForProvider(c.Req.Context(), key)
	if err != nil {
		return response.Error(404, "The provider was not found", err)
	}

	return response.JSON(200, settings)
}

func (api *Api) UpdateProviderSettings(c *contextmodel.ReqContext) response.Response {
	key, ok := web.Params(c.Req)[":key"]
	if !ok {
		return response.Error(400, "Missing key", nil)
	}

	var newSettings models.SSOSetting
	if err := web.Bind(c.Req, &newSettings); err != nil {
		return response.Error(400, "Failed to parse request body", err)
	}

	err := api.SSOSettingsService.Upsert(c.Req.Context(), key, newSettings.Settings)
	// TODO: first check whether the error is referring to validation errors

	// other error
	if err != nil {
		return response.Error(500, "Failed to update provider settings", err)
	}

	return response.JSON(204, nil)
}

func (api *Api) RemoveProviderSettings(c *contextmodel.ReqContext) response.Response {
	key, ok := web.Params(c.Req)[":key"]
	if !ok {
		return response.Error(400, "Missing key", nil)
	}

	err := api.SSOSettingsService.Delete(c.Req.Context(), key)
	if err != nil {
		return response.Error(500, "Failed to delete provider settings", err)
	}

	return response.JSON(204, nil)
}
