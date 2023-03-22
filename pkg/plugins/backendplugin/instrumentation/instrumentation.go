// Package instrumentation contains backend plugin instrumentation logic.
package instrumentation

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/attribute"

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
)

const (
	statusOK        = "ok"
	statusError     = "error"
	statusCancelled = "cancelled"
)

var logger = plog.New("plugin.instrumentation")

// instrumentPluginRequest instruments success rate and latency of `fn`
func instrumentPluginRequest(ctx context.Context, cfg Cfg, pluginCtx *backend.PluginContext, endpoint string, tracer tracing.Tracer, fn func() error, extraTraceAttributes map[string]interface{}) error {
	status := statusOK

	start := time.Now()
	timeBeforePluginRequest := log.TimeSinceStart(ctx, start)

	traceCtx, span := tracer.Start(ctx, "plugin.request."+endpoint)
	defer span.End()
	err := fn()
	if err != nil {
		span.RecordError(err)
		status = statusError
		if errors.Is(err, context.Canceled) {
			status = statusCancelled
		}
	}

	elapsed := time.Since(start)
	pluginRequestDuration.WithLabelValues(pluginCtx.PluginID, endpoint, string(cfg.Target)).Observe(float64(elapsed / time.Millisecond))
	pluginRequestCounter.WithLabelValues(pluginCtx.PluginID, endpoint, status, string(cfg.Target)).Inc()

	instrumentationParams := map[string]interface{}{
		"status":                     status,
		"duration":                   elapsed,
		"pluginId":                   pluginCtx.PluginID,
		"endpoint":                   endpoint,
		"eventName":                  "grafana-data-egress",
		"time_before_plugin_request": timeBeforePluginRequest,
	}

	if pluginCtx.User != nil {
		instrumentationParams["uname"] = pluginCtx.User.Login
	}

	traceID := tracing.TraceIDFromContext(traceCtx, false)
	if traceID != "" {
		instrumentationParams["traceID"] = traceID
	}

	if pluginCtx.DataSourceInstanceSettings != nil {
		instrumentationParams["dsName"] = pluginCtx.DataSourceInstanceSettings.Name
		instrumentationParams["dsUID"] = pluginCtx.DataSourceInstanceSettings.UID
	}

	if status == statusError {
		instrumentationParams["error"] = err
	}

	logParams := make([]interface{}, 0, len(instrumentationParams)/2)
	for key, value := range instrumentationParams {
		logParams = append(logParams, key, value)
		if key != "TraceID" {
			addToSpan(span, key, value)
		}
	}

	if cfg.LogDatasourceRequests {
		logger.Info("Plugin Request Completed", logParams...)
	}
	for key, value := range extraTraceAttributes {
		span.SetAttributes(key, value, attribute.Key(key).String(value.(string)))
	}

	return err
}

type Cfg struct {
	LogDatasourceRequests bool
	Target                backendplugin.Target
}

// InstrumentCollectMetrics instruments collectMetrics.
func InstrumentCollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest, cfg Cfg, tracer tracing.Tracer, fn func() error) error {
	return instrumentPluginRequest(ctx, cfg, &req.PluginContext, "collectMetrics", tracer, fn, nil)
}

// InstrumentCheckHealthRequest instruments checkHealth.
func InstrumentCheckHealthRequest(ctx context.Context, req *backend.CheckHealthRequest, cfg Cfg, tracer tracing.Tracer, fn func() error) error {
	return instrumentPluginRequest(ctx, cfg, &req.PluginContext, "checkHealth", tracer, fn, nil)
}

// InstrumentCallResourceRequest instruments callResource.
func InstrumentCallResourceRequest(ctx context.Context, req *backend.CallResourceRequest, cfg Cfg, tracer tracing.Tracer, fn func() error) error {
	return instrumentPluginRequest(ctx, cfg, &req.PluginContext, "callResource", tracer, fn, map[string]interface{}{
		"dashboard_uid": req.GetHTTPHeader("X-Dashboard-Uid"),
		"panel_id":      req.GetHTTPHeader("X-Panel-Id"),
	})
}

// InstrumentQueryDataRequest instruments success rate and latency of query data requests.
func InstrumentQueryDataRequest(ctx context.Context, req *backend.QueryDataRequest, cfg Cfg, tracer tracing.Tracer, fn func() error) error {
	return instrumentPluginRequest(ctx, cfg, &req.PluginContext, "queryData", tracer, fn, map[string]interface{}{
		"dashboard_uid": req.GetHTTPHeader("X-Dashboard-Uid"),
		"panel_id":      req.GetHTTPHeader("X-Panel-Id"),
	})
}

func addToSpan(span tracing.Span, key string, value interface{}) {
	switch value := value.(type) {
	case string:
		span.SetAttributes(key, value, attribute.Key(key).String(value))
	case int64:
		span.SetAttributes(key, value, attribute.Key(key).Int64(value))
	case int:
		span.SetAttributes(key, value, attribute.Key(key).Int(value))
	case bool:
		span.SetAttributes(key, value, attribute.Key(key).Bool(value))
	case float64:
		span.SetAttributes(key, value, attribute.Key(key).Float64(value))
	}
}
