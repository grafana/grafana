package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) registerOpenFeatureRoutes(apiRoute routing.RouteRegister) {
	if hs.Cfg.OpenFeature.ProviderType == setting.StaticProviderType {
		apiRoute.Group("/ofrep/v1", func(apiRoute routing.RouteRegister) {
			apiRoute.Post("/evaluate/flags", hs.allFlagsStaticProvider)
			apiRoute.Post("/evaluate/flags/:flagKey", hs.evalFlagStaticProvider)
		})
	}
}

func (hs *HTTPServer) evalFlagStaticProvider(c *contextmodel.ReqContext) response.Response {
	flagKey := web.Params(c.Req)[":flagKey"]
	if flagKey == "" {
		return response.Error(http.StatusBadRequest, "flagKey is required", nil)
	}

	flags, err := hs.openFeature.EvalFlagWithStaticProvider(c.Req.Context(), flagKey)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to evaluate feature flag", err)
	}

	return response.JSON(http.StatusOK, flags)
}

func (hs *HTTPServer) allFlagsStaticProvider(c *contextmodel.ReqContext) response.Response {
	flags, err := hs.openFeature.EvalAllFlagsWithStaticProvider(c.Req.Context())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to evaluate feature flags", err)
	}

	return response.JSON(http.StatusOK, flags)
}
