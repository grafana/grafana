// Package instrumentation contains backend plugin instrumentation logic.
package instrumentation

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	pluginRequestCounter = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "plugin_request_total",
		Help:      "The total amount of plugin requests",
	}, []string{"plugin_id", "endpoint", "status"})

	pluginRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "plugin_request_duration_milliseconds",
		Help:      "Plugin request duration",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
	}, []string{"plugin_id", "endpoint"})
)

var logger log.Logger = log.New("plugin.instrumentation")

// instrumentPluginRequest instruments success rate and latency of `fn`
func instrumentPluginRequest(ctx context.Context, cfg *setting.Cfg, pluginCtx *backend.PluginContext, endpoint string, fn func() error) error {
	status := "ok"

	start := time.Now()

	err := fn()
	if err != nil {
		status = "error"
	}

	elapsed := time.Since(start)
	pluginRequestDuration.WithLabelValues(pluginCtx.PluginID, endpoint).Observe(float64(elapsed / time.Millisecond))
	pluginRequestCounter.WithLabelValues(pluginCtx.PluginID, endpoint, status).Inc()

	if cfg.IsFeatureToggleEnabled(featuremgmt.FlagDatasourceLogger) {
		logParams := []interface{}{
			"status", status,
			"duration", elapsed,
			"plugin_id", pluginCtx.PluginID,
			"endpoint", endpoint,
		}

		traceID := tracing.TraceIDFromContext(ctx, false)
		if traceID != "" {
			logParams = append(logParams, "traceID", traceID)
		}

		if pluginCtx.DataSourceInstanceSettings != nil {
			logParams = append(logParams, "ds_name", pluginCtx.DataSourceInstanceSettings.Name)
			logParams = append(logParams, "ds_uid", pluginCtx.DataSourceInstanceSettings.UID)
		}

		logger.Info("Plugin Request Completed", logParams...)
	}

	return err
}

// InstrumentCollectMetrics instruments collectMetrics.
func InstrumentCollectMetrics(ctx context.Context, cfg *setting.Cfg, req *backend.PluginContext, fn func() error) error {
	return instrumentPluginRequest(ctx, cfg, req, "collectMetrics", fn)
}

// InstrumentCheckHealthRequest instruments checkHealth.
func InstrumentCheckHealthRequest(ctx context.Context, cfg *setting.Cfg, req *backend.PluginContext, fn func() error) error {
	return instrumentPluginRequest(ctx, cfg, req, "checkHealth", fn)
}

// InstrumentCallResourceRequest instruments callResource.
func InstrumentCallResourceRequest(ctx context.Context, cfg *setting.Cfg, req *backend.PluginContext, fn func() error) error {
	return instrumentPluginRequest(ctx, cfg, req, "callResource", fn)
}

// InstrumentQueryDataRequest instruments success rate and latency of query data requests.
func InstrumentQueryDataRequest(ctx context.Context, cfg *setting.Cfg, req *backend.PluginContext, fn func() error) error {
	return instrumentPluginRequest(ctx, cfg, req, "queryData", fn)
}
