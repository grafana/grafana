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

	PluginRequestDurationSeconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "plugin_request_duration_seconds",
		Help:      "Plugin request duration in seconds",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25},
	}, []string{"source", "plugin_id", "endpoint", "status", "target", "errorSource"})
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

type errorSource string

const (
	grafanaSource          errorSource = "grafana"
	userSource             errorSource = "user"
	downstreamClientSource errorSource = "downstreamClient"
	downstreamServerSource errorSource = "downstreamServer"
	noneSource             errorSource = "none"
)

var logger = plog.New("plugin.instrumentation")

// instrumentPluginRequest instruments success rate and latency of `fn`
func instrumentPluginRequest(ctx context.Context, cfg Cfg, pluginCtx *backend.PluginContext, endpoint string, fn func() error) error {
	start := time.Now()
	timeBeforePluginRequest := log.TimeSinceStart(ctx, start)

	err := fn()

	elapsed := time.Since(start)
	status := getStatus(err)

	logger.Info("Plugin Request Completed")

	updateMetrics(pluginCtx.PluginID, endpoint, string(cfg.Target), elapsed, status, noneSource)
	logDatasourceRequests(ctx, cfg, pluginCtx, endpoint, status, elapsed, timeBeforePluginRequest, err)

	return err
}

func InstrumentQueryDataRequest(ctx context.Context, cfg Cfg, pluginCtx *backend.PluginContext, requestSize float64, fn func() (*backend.QueryDataResponse, error)) (*backend.QueryDataResponse, error) {
	start := time.Now()
	timeBeforePluginRequest := log.TimeSinceStart(ctx, start)

	resp, err := fn()

	elapsed := time.Since(start)
	logger.Info("Plugin Request Completed")

	status := getStatus(err)
	errorSource := getErrorSource(status, resp)

	updateMetrics(pluginCtx.PluginID, endpointQueryData, string(cfg.Target), elapsed, status, string(errorSource))
	pluginRequestSizeHistogram.WithLabelValues("grafana-backend", pluginCtx.PluginID, endpointQueryData, string(cfg.Target)).Observe(requestSize)
	logDatasourceRequests(ctx, cfg, pluginCtx, endpointQueryData, status, elapsed, timeBeforePluginRequest, err)

	return resp, err
}

func getErrorSource(status string, resp *backend.QueryDataResponse) errorSource {
	if status == statusError {
		return grafanaSource
	}

	if status == statusCancelled {
		return userSource
	}

	var highestStatusCode backend.Status = 0
	for _, res := range resp.Responses {
		if res.Error != nil {
			return grafanaSource
		}

		if res.Status > highestStatusCode {
			highestStatusCode = res.Status
		}
	}

	if highestStatusCode >= 500 {
		return downstreamServerSource
	}

	if highestStatusCode >= 400 {
		return downstreamClientSource
	}

	return noneSource
}

func getStatus(err error) string {
	if err == nil {
		return statusOK
	}

	if errors.Is(err, context.Canceled) {
		return statusCancelled
	}

	return statusError
}

func updateMetrics(pluginId string, endpoint string, target string, elapsed time.Duration, status string, errorSource string) {
	pluginRequestDuration.WithLabelValues(pluginId, endpoint, target).Observe(float64(elapsed / time.Millisecond))
	pluginRequestCounter.WithLabelValues(pluginId, endpoint, status, target).Inc()
	PluginRequestDurationSeconds.WithLabelValues("grafana-backend", pluginId, endpoint, status, target, errorSource).Observe(elapsed.Seconds())
}

func logDatasourceRequests(ctx context.Context, cfg Cfg, pluginCtx *backend.PluginContext, endpoint string, status string, elapsed time.Duration, timeBeforePluginRequest time.Duration, err error) {
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
