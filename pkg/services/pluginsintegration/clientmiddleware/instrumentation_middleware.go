package clientmiddleware

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
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

// NewInstrumentationMiddleware creates a new plugins.ClientMiddleware
// that will instrumentation QueryData, CallResource, CheckHealth and
// CollectMetrics requests made from a backend plugin.
func NewInstrumentationMiddleware(cfg InstrumentationMiddlewareConfig) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &InstrumentationMiddleware{
			cfg:  InstrumentationMiddlewareConfig{LogDatasourceRequests: cfg.LogDatasourceRequests},
			next: next,
		}
	})
}

type InstrumentationMiddleware struct {
	cfg  InstrumentationMiddlewareConfig
	next plugins.Client
}

var logger log.Logger = log.New("plugin.instrumentation")

type InstrumentationMiddlewareConfig struct {
	LogDatasourceRequests bool
}

func instrument(ctx context.Context, cfg InstrumentationMiddlewareConfig, pluginCtx *backend.PluginContext, endpoint string, fn func() error) error {
	start := time.Now()

	status := "ok"
	err := fn()
	if err != nil {
		status = "error"
	}

	elapsed := time.Since(start)
	pluginRequestDuration.WithLabelValues(pluginCtx.PluginID, endpoint).Observe(float64(elapsed / time.Millisecond))
	pluginRequestCounter.WithLabelValues(pluginCtx.PluginID, endpoint, status).Inc()

	if cfg.LogDatasourceRequests {
		logParams := []interface{}{
			"status", status,
			"duration", elapsed,
			"pluginId", pluginCtx.PluginID,
			"endpoint", endpoint,
			"eventName", "grafana-data-egress",
			"insight_logs", true,
			"since_grafana_request_started", log.TimeSinceStart(ctx, time.Now()),
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

		logger.Info("Plugin Request Completed", logParams...)
	}
	return nil
}

func (m *InstrumentationMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	var resp *backend.QueryDataResponse
	err := instrumentQueryDataRequest(ctx, &req.PluginContext, m.cfg, func() (innerErr error) {
		resp, innerErr = m.next.QueryData(ctx, req)
		return
	})

	return resp, err
}

func (m *InstrumentationMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	err := instrumentCallResourceRequest(ctx, &req.PluginContext, m.cfg, func() (innerErr error) {
		innerErr = m.next.CallResource(ctx, req, sender)
		return
	})

	return err
}

func (m *InstrumentationMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	var resp *backend.CheckHealthResult
	err := instrumentCheckHealthRequest(ctx, &req.PluginContext, m.cfg, func() (innerErr error) {
		resp, innerErr = m.next.CheckHealth(ctx, req)
		return
	})

	return resp, err
}

func (m *InstrumentationMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if req == nil {
		return m.next.CollectMetrics(ctx, req)
	}

	var resp *backend.CollectMetricsResult
	err := instrumentCollectMetrics(ctx, &req.PluginContext, m.cfg, func() (innerErr error) {
		resp, innerErr = m.next.CollectMetrics(ctx, req)
		return
	})

	return resp, err
}

func (m *InstrumentationMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *InstrumentationMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *InstrumentationMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}

func instrumentQueryDataRequest(ctx context.Context, req *backend.PluginContext, cfg InstrumentationMiddlewareConfig, fn func() error) error {
	return instrument(ctx, cfg, req, "queryData", fn)
}
func instrumentCallResourceRequest(ctx context.Context, req *backend.PluginContext, cfg InstrumentationMiddlewareConfig, fn func() error) error {
	return instrument(ctx, cfg, req, "callResource", fn)
}

func instrumentCheckHealthRequest(ctx context.Context, req *backend.PluginContext, cfg InstrumentationMiddlewareConfig, fn func() error) error {
	return instrument(ctx, cfg, req, "checkHealth", fn)
}

func instrumentCollectMetrics(ctx context.Context, req *backend.PluginContext, cfg InstrumentationMiddlewareConfig, fn func() error) error {
	return instrument(ctx, cfg, req, "collectMetrics", fn)
}
