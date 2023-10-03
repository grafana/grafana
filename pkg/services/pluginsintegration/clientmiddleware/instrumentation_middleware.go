package clientmiddleware

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

type metrics struct {
	pluginRequestCounter         *prometheus.CounterVec
	pluginRequestDuration        *prometheus.HistogramVec
	pluginRequestSizeHistogram   *prometheus.HistogramVec
	pluginRequestDurationSeconds *prometheus.HistogramVec
}

type InstrumentationMiddleware struct {
	metrics
	pluginRegistry registry.Service
	next           plugins.Client
}

func NewInstrumentationMiddleware(promRegisterer prometheus.Registerer, pluginRegistry registry.Service) (plugins.ClientMiddleware, error) {
	metrics := metrics{
		pluginRequestCounter: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Name:      "plugin_request_total",
			Help:      "The total amount of plugin requests",
		}, []string{"plugin_id", "endpoint", "status", "target"}),
		pluginRequestDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "plugin_request_duration_milliseconds",
			Help:      "Plugin request duration",
			Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
		}, []string{"plugin_id", "endpoint", "target"}),
		pluginRequestSizeHistogram: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "grafana",
				Name:      "plugin_request_size_bytes",
				Help:      "histogram of plugin request sizes returned",
				Buckets:   []float64{128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576},
			}, []string{"source", "plugin_id", "endpoint", "target"},
		),
		pluginRequestDurationSeconds: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "plugin_request_duration_seconds",
			Help:      "Plugin request duration in seconds",
			Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25},
		}, []string{"source", "plugin_id", "endpoint", "status", "target"}),
	}
	for _, c := range []prometheus.Collector{
		metrics.pluginRequestCounter,
		metrics.pluginRequestDuration,
		metrics.pluginRequestSizeHistogram,
		metrics.pluginRequestDurationSeconds,
	} {
		if err := promRegisterer.Register(c); err != nil {
			return nil, fmt.Errorf("prometheus register: %w", err)
		}
	}
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &InstrumentationMiddleware{
			metrics:        metrics,
			next:           next,
			pluginRegistry: pluginRegistry,
		}
	}), nil
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (m *InstrumentationMiddleware) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return nil, false
	}

	if p.IsDecommissioned() {
		return nil, false
	}

	return p, true
}

func (m *InstrumentationMiddleware) pluginTarget(ctx context.Context, pluginID string) (string, error) {
	p, ok := m.plugin(ctx, pluginID)
	if !ok {
		return "", plugins.ErrPluginNotRegistered
	}
	return string(p.Target()), nil
}

func instrumentContext(ctx context.Context, endpoint string, pCtx backend.PluginContext) context.Context {
	p := []any{"endpoint", endpoint, "pluginId", pCtx.PluginID}
	if pCtx.DataSourceInstanceSettings != nil {
		p = append(p, "dsName", pCtx.DataSourceInstanceSettings.Name)
		p = append(p, "dsUID", pCtx.DataSourceInstanceSettings.UID)
	}
	if pCtx.User != nil {
		p = append(p, "uname", pCtx.User.Login)
	}
	return log.WithContextualAttributes(ctx, p)
}

func (m *InstrumentationMiddleware) instrumentPluginRequestSize(pluginID, target string, requestSize float64) {
	m.pluginRequestSizeHistogram.WithLabelValues("grafana-backend", pluginID, endpointQueryData, target).Observe(requestSize)
}

func (m *InstrumentationMiddleware) instrumentPluginRequest(ctx context.Context, pluginCtx backend.PluginContext, endpoint string, target string, fn func(context.Context) error) error {
	status := statusOK
	start := time.Now()

	ctx = instrumentContext(ctx, endpoint, pluginCtx)
	err := fn(ctx)
	if err != nil {
		status = statusError
		if errors.Is(err, context.Canceled) {
			status = statusCancelled
		}
	}

	elapsed := time.Since(start)

	pluginRequestDurationWithLabels := m.pluginRequestDuration.WithLabelValues(pluginCtx.PluginID, endpoint, target)
	pluginRequestCounterWithLabels := m.pluginRequestCounter.WithLabelValues(pluginCtx.PluginID, endpoint, status, target)
	pluginRequestDurationSecondsWithLabels := m.pluginRequestDurationSeconds.WithLabelValues("grafana-backend", pluginCtx.PluginID, endpoint, status, target)

	if traceID := tracing.TraceIDFromContext(ctx, true); traceID != "" {
		pluginRequestDurationWithLabels.(prometheus.ExemplarObserver).ObserveWithExemplar(
			float64(elapsed/time.Millisecond), prometheus.Labels{"traceID": traceID},
		)
		pluginRequestCounterWithLabels.(prometheus.ExemplarAdder).AddWithExemplar(1, prometheus.Labels{"traceID": traceID})
		pluginRequestDurationSecondsWithLabels.(prometheus.ExemplarObserver).ObserveWithExemplar(
			elapsed.Seconds(), prometheus.Labels{"traceID": traceID},
		)
	} else {
		pluginRequestDurationWithLabels.Observe(float64(elapsed / time.Millisecond))
		pluginRequestCounterWithLabels.Inc()
		pluginRequestDurationSecondsWithLabels.Observe(elapsed.Seconds())
	}

	return err
}

func (m *InstrumentationMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	target, err := m.pluginTarget(ctx, req.PluginContext.PluginID)
	if err != nil {
		return nil, err
	}
	var requestSize float64
	for _, v := range req.Queries {
		requestSize += float64(len(v.JSON))
	}
	m.instrumentPluginRequestSize(req.PluginContext.PluginID, target, requestSize)
	var resp *backend.QueryDataResponse
	err = m.instrumentPluginRequest(ctx, req.PluginContext, endpointQueryData, target, func(ctx context.Context) (innerErr error) {
		resp, innerErr = m.next.QueryData(ctx, req)
		return innerErr
	})
	return resp, err
}

func (m *InstrumentationMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	target, err := m.pluginTarget(ctx, req.PluginContext.PluginID)
	if err != nil {
		return err
	}
	m.instrumentPluginRequestSize(req.PluginContext.PluginID, target, float64(len(req.Body)))
	return m.instrumentPluginRequest(ctx, req.PluginContext, endpointCallResource, target, func(ctx context.Context) error {
		return m.next.CallResource(ctx, req, sender)
	})
}

func (m *InstrumentationMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	target, err := m.pluginTarget(ctx, req.PluginContext.PluginID)
	if err != nil {
		return nil, err
	}
	var result *backend.CheckHealthResult
	err = m.instrumentPluginRequest(ctx, req.PluginContext, endpointCallResource, target, func(ctx context.Context) (innerErr error) {
		result, innerErr = m.next.CheckHealth(ctx, req)
		return
	})
	return result, err
}

func (m *InstrumentationMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	target, err := m.pluginTarget(ctx, req.PluginContext.PluginID)
	if err != nil {
		return nil, err
	}
	var result *backend.CollectMetricsResult
	err = m.instrumentPluginRequest(ctx, req.PluginContext, endpointCollectMetrics, target, func(ctx context.Context) (innerErr error) {
		result, innerErr = m.next.CollectMetrics(ctx, req)
		return
	})
	return result, err
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
