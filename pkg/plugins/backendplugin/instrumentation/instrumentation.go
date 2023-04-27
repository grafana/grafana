// Package instrumentation contains backend plugin instrumentation logic.
package instrumentation

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	plog "github.com/grafana/grafana/pkg/plugins/log"
)

var (
	pluginRequestCounter = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "plugin_request_total",
		Help:      "The total amount of plugin requests",
	}, []string{"plugin_id", "endpoint", "status", "target"})

	pluginRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "plugin_request_duration_milliseconds",
		Help:      "Plugin request duration",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
	}, []string{"plugin_id", "endpoint", "target"})

	pluginRequestSizeHistogram = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "plugin_request_size_bytes",
			Help:      "histogram of plugin request sizes returned",
			Buckets:   []float64{128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576},
		}, []string{"source", "plugin_id", "endpoint", "target"},
	)

	PluginRequestDurationSeconds = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "plugin_request_duration_seconds",
		Help:      "Plugin request duration in seconds",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25},
	}, []string{"source", "plugin_id", "endpoint", "status", "target"})
)

const (
	statusOK        = "ok"
	statusError     = "error"
	statusCancelled = "cancelled"

	endpointCallResource   = "callResource"
	endpointCheckHealth    = "checkHealth"
	endpointCollectMetrics = "collectMetrics"
	endpointQueryData      = "queryData"
)

var logger = plog.New("plugin.instrumentation")

// instrumentPluginRequest instruments success rate and latency of `fn`
func instrumentPluginRequest(ctx context.Context, cfg Cfg, pluginCtx *backend.PluginContext, endpoint string, fn func() error) error {
	status := statusOK

	start := time.Now()
	timeBeforePluginRequest := log.TimeSinceStart(ctx, start)

	err := fn()
	if err != nil {
		status = statusError
		if errors.Is(err, context.Canceled) {
			status = statusCancelled
		}
	}

	elapsed := time.Since(start)
	pluginRequestDuration.WithLabelValues(pluginCtx.PluginID, endpoint, string(cfg.Target)).Observe(float64(elapsed / time.Millisecond))
	pluginRequestCounter.WithLabelValues(pluginCtx.PluginID, endpoint, status, string(cfg.Target)).Inc()

	PluginRequestDurationSeconds.WithLabelValues("grafana-backend", pluginCtx.PluginID, endpoint, string(cfg.Target), status).Observe(elapsed.Seconds())

	if cfg.LogDatasourceRequests {
		logParams := []interface{}{
			"status", status,
			"duration", elapsed,
			"pluginId", pluginCtx.PluginID,
			"endpoint", endpoint,
			"eventName", "grafana-data-egress",
			"time_before_plugin_request", timeBeforePluginRequest,
		}

		if pluginCtx.User != nil {
			logParams = append(logParams, "uname", pluginCtx.User.Login)
		}

		traceID := tracing.TraceIDFromContext(ctx, false)
		if traceID != "" {
			logParams = append(logParams, "traceID", traceID)
		}

		if pluginCtx.DataSourceInstanceSettings != nil {
			logParams = append(logParams, "dsName", pluginCtx.DataSourceInstanceSettings.Name)
			logParams = append(logParams, "dsUID", pluginCtx.DataSourceInstanceSettings.UID)
		}

		if status == statusError {
			logParams = append(logParams, "error", err)
		}

		logger.Info("Plugin Request Completed", logParams...)
	}

	return err
}

type Cfg struct {
	LogDatasourceRequests bool
	Target                backendplugin.Target
}

// InstrumentCollectMetrics instruments collectMetrics.
func InstrumentCollectMetrics(ctx context.Context, req *backend.PluginContext, cfg Cfg, fn func() error) error {
	return instrumentPluginRequest(ctx, cfg, req, endpointCollectMetrics, fn)
}

// InstrumentCheckHealthRequest instruments checkHealth.
func InstrumentCheckHealthRequest(ctx context.Context, req *backend.PluginContext, cfg Cfg, fn func() error) error {
	return instrumentPluginRequest(ctx, cfg, req, endpointCheckHealth, fn)
}

// InstrumentCallResourceRequest instruments callResource.
func InstrumentCallResourceRequest(ctx context.Context, req *backend.PluginContext, cfg Cfg, requestSize float64, fn func() error) error {
	pluginRequestSizeHistogram.WithLabelValues("grafana-backend", req.PluginID, endpointCallResource,
		string(cfg.Target)).Observe(requestSize)
	return instrumentPluginRequest(ctx, cfg, req, endpointCallResource, fn)
}

// InstrumentQueryDataRequest instruments success rate and latency of query data requests.
func InstrumentQueryDataRequest(ctx context.Context, req *backend.PluginContext, cfg Cfg,
	requestSize float64, fn func() error) error {
	pluginRequestSizeHistogram.WithLabelValues("grafana-backend", req.PluginID, endpointQueryData,
		string(cfg.Target)).Observe(requestSize)
	return instrumentPluginRequest(ctx, cfg, req, endpointQueryData, fn)
}
