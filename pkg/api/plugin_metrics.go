package api

import (
	"errors"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) pluginMetricsEndpoint(ctx *web.Context) {
	if !hs.Cfg.MetricsEndpointEnabled {
		return
	}

	if ctx.Req.Method != http.MethodGet || !strings.HasPrefix(ctx.Req.URL.Path, "/metrics/plugins/") {
		return
	}

	if hs.metricsEndpointBasicAuthEnabled() && !BasicAuthenticatedRequest(ctx.Req, hs.Cfg.MetricsEndpointBasicAuthUsername, hs.Cfg.MetricsEndpointBasicAuthPassword) {
		ctx.Resp.WriteHeader(http.StatusUnauthorized)
		return
	}

	pathParts := strings.SplitAfter(ctx.Req.URL.Path, "/")
	pluginID := pathParts[len(pathParts)-1]

	resp, err := hs.pluginClient.CollectMetrics(ctx.Req.Context(), &backend.CollectMetricsRequest{PluginContext: backend.PluginContext{PluginID: pluginID}})
	if err != nil {
		if errors.Is(err, backendplugin.ErrPluginNotRegistered) {
			ctx.Resp.WriteHeader(http.StatusNotFound)
			return
		}

		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}

	ctx.Resp.Header().Set("Content-Type", "text/plain")
	if _, err := ctx.Resp.Write(resp.PrometheusMetrics); err != nil {
		hs.log.Error("Failed to write to response", "err", err)
	}
}
