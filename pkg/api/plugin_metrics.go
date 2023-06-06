package api

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-jose/go-jose/v3/json"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/discovery"

	"github.com/grafana/grafana/pkg/plugins"
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
	if _, err = ctx.Resp.Write(resp.PrometheusMetrics); err != nil {
		hs.log.Error("Failed to write to response", "err", err)
	}
}

func (hs *HTTPServer) pluginMetricsScrapeTargetsEndpoint(ctx *web.Context) {
	if !hs.Cfg.MetricsEndpointEnabled {
		return
	}

	if ctx.Req.Method != http.MethodGet || !strings.EqualFold(ctx.Req.URL.Path, "/metrics/plugins") {
		return
	}

	if hs.metricsEndpointBasicAuthEnabled() && !BasicAuthenticatedRequest(ctx.Req, hs.Cfg.MetricsEndpointBasicAuthUsername, hs.Cfg.MetricsEndpointBasicAuthPassword) {
		ctx.Resp.WriteHeader(http.StatusUnauthorized)
		return
	}

	var sdConfig discovery.Configs
	for _, p := range hs.pluginStore.Plugins(ctx.Req.Context()) {
		if p.Class == plugins.External { // TODO and is configured to expose metrics
			sdConfig = append(sdConfig, discovery.StaticConfig{{
				Targets: []model.LabelSet{{model.AddressLabel: model.LabelValue(pluginMetricEndpoint(ctx.Req, p.ID))}},
				Labels: model.LabelSet{
					"pluginId": model.LabelValue(p.ID),
				},
				Source: "plugins",
			}})
		}
	}

	if sdConfig == nil {
		ctx.Resp.Header().Set("Content-Type", "application/json")
		if _, err := ctx.Resp.Write([]byte("[]")); err != nil {
			hs.log.Error("Failed to write to response", "err", err)
		}
		return
	}

	b, err := json.Marshal(sdConfig)
	if err != nil {
		ctx.Resp.WriteHeader(http.StatusInternalServerError)
		return
	}

	ctx.Resp.Header().Set("Content-Type", "application/json")
	if _, err = ctx.Resp.Write(b); err != nil {
		hs.log.Error("Failed to write to response", "err", err)
	}
}

func pluginMetricEndpoint(req *http.Request, pluginID string) string {
	return fmt.Sprintf("%s/metrics/plugins/%s", req.Host, pluginID)
}
