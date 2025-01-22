package clientmiddleware

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/instrumentationutils"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

// pluginMetrics contains the prometheus metrics used by the MetricsMiddleware.
type pluginMetrics struct {
	pluginRequestCounter         *prometheus.CounterVec
	pluginRequestDuration        *prometheus.HistogramVec
	pluginRequestSize            *prometheus.HistogramVec
	pluginRequestDurationSeconds *prometheus.HistogramVec
}

// MetricsMiddleware is a middleware that instruments plugin requests.
// It tracks requests count, duration and size as prometheus metrics.
type MetricsMiddleware struct {
	backend.BaseHandler
	pluginMetrics
	pluginRegistry registry.Service
}

func newMetricsMiddleware(promRegisterer prometheus.Registerer, pluginRegistry registry.Service) *MetricsMiddleware {
	additionalLabels := []string{"status_source"}
	pluginRequestCounter := prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "plugin_request_total",
		Help:      "The total amount of plugin requests",
	}, append([]string{"plugin_id", "endpoint", "status", "target"}, additionalLabels...))
	pluginRequestDuration := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "plugin_request_duration_milliseconds",
		Help:      "Plugin request duration",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25, 50, 100},
	}, append([]string{"plugin_id", "endpoint", "target"}, additionalLabels...))
	pluginRequestSize := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "grafana",
			Name:      "plugin_request_size_bytes",
			Help:      "histogram of plugin request sizes returned",
			Buckets:   []float64{128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576},
		}, []string{"source", "plugin_id", "endpoint", "target"},
	)
	pluginRequestDurationSeconds := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "plugin_request_duration_seconds",
		Help:      "Plugin request duration in seconds",
		Buckets:   []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 25},
	}, append([]string{"source", "plugin_id", "endpoint", "status", "target"}, additionalLabels...))
	promRegisterer.MustRegister(
		pluginRequestCounter,
		pluginRequestDuration,
		pluginRequestSize,
		pluginRequestDurationSeconds,
	)
	return &MetricsMiddleware{
		pluginMetrics: pluginMetrics{
			pluginRequestCounter:         pluginRequestCounter,
			pluginRequestDuration:        pluginRequestDuration,
			pluginRequestSize:            pluginRequestSize,
			pluginRequestDurationSeconds: pluginRequestDurationSeconds,
		},
		pluginRegistry: pluginRegistry,
	}
}

// NewMetricsMiddleware returns a new MetricsMiddleware.
func NewMetricsMiddleware(promRegisterer prometheus.Registerer, pluginRegistry registry.Service) backend.HandlerMiddleware {
	metrics := newMetricsMiddleware(promRegisterer, pluginRegistry)
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &MetricsMiddleware{
			BaseHandler:    backend.NewBaseHandler(next),
			pluginMetrics:  metrics.pluginMetrics,
			pluginRegistry: metrics.pluginRegistry,
		}
	})
}

// pluginTarget returns the value for the "target" Prometheus label for the given plugin ID.
func (m *MetricsMiddleware) pluginTarget(ctx context.Context, pluginID, pluginVersion string) (string, error) {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID, pluginVersion)
	if !exists {
		return "", plugins.ErrPluginNotRegistered
	}
	return string(p.Target()), nil
}

// instrumentPluginRequestSize tracks the size of the given request in the m.pluginRequestSize metric.
func (m *MetricsMiddleware) instrumentPluginRequestSize(ctx context.Context, pluginCtx backend.PluginContext, requestSize float64) error {
	target, err := m.pluginTarget(ctx, pluginCtx.PluginID, pluginCtx.PluginVersion)
	if err != nil {
		return err
	}
	endpoint := backend.EndpointFromContext(ctx)
	m.pluginRequestSize.WithLabelValues("grafana-backend", pluginCtx.PluginID, string(endpoint), target).Observe(requestSize)
	return nil
}

// instrumentPluginRequest increments the m.pluginRequestCounter metric and tracks the duration of the given request.
func (m *MetricsMiddleware) instrumentPluginRequest(ctx context.Context, pluginCtx backend.PluginContext, fn func(context.Context) (instrumentationutils.RequestStatus, error)) error {
	target, err := m.pluginTarget(ctx, pluginCtx.PluginID, pluginCtx.PluginVersion)
	if err != nil {
		return err
	}

	start := time.Now()

	status, err := fn(ctx)
	elapsed := time.Since(start)

	statusSource := backend.ErrorSourceFromContext(ctx)
	endpoint := backend.EndpointFromContext(ctx)

	pluginRequestDurationWithLabels := m.pluginRequestDuration.WithLabelValues(pluginCtx.PluginID, string(endpoint), target, string(statusSource))
	pluginRequestCounterWithLabels := m.pluginRequestCounter.WithLabelValues(pluginCtx.PluginID, string(endpoint), status.String(), target, string(statusSource))
	pluginRequestDurationSecondsWithLabels := m.pluginRequestDurationSeconds.WithLabelValues("grafana-backend", pluginCtx.PluginID, string(endpoint), status.String(), target, string(statusSource))

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

func (m *MetricsMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	var requestSize float64
	for _, v := range req.Queries {
		requestSize += float64(len(v.JSON))
	}

	if err := m.instrumentPluginRequestSize(ctx, req.PluginContext, requestSize); err != nil {
		return nil, err
	}

	var resp *backend.QueryDataResponse
	err := m.instrumentPluginRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.QueryData(ctx, req)
		return instrumentationutils.RequestStatusFromQueryDataResponse(resp, innerErr), innerErr
	})

	return resp, err
}

func (m *MetricsMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if err := m.instrumentPluginRequestSize(ctx, req.PluginContext, float64(len(req.Body))); err != nil {
		return err
	}
	return m.instrumentPluginRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		innerErr := m.BaseHandler.CallResource(ctx, req, sender)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})
}

func (m *MetricsMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	var resp *backend.CheckHealthResult
	err := m.instrumentPluginRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.CheckHealth(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *MetricsMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	var resp *backend.CollectMetricsResult
	err := m.instrumentPluginRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.CollectMetrics(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})
	return resp, err
}

func (m *MetricsMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	var resp *backend.SubscribeStreamResponse
	err := m.instrumentPluginRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.SubscribeStream(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})
	return resp, err
}

func (m *MetricsMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	var resp *backend.PublishStreamResponse
	err := m.instrumentPluginRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.PublishStream(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})
	return resp, err
}

func (m *MetricsMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	err := m.instrumentPluginRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		innerErr := m.BaseHandler.RunStream(ctx, req, sender)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})
	return err
}

func (m *MetricsMiddleware) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	var resp *backend.ValidationResponse
	err := m.instrumentPluginRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.ValidateAdmission(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *MetricsMiddleware) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	var resp *backend.MutationResponse
	err := m.instrumentPluginRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.MutateAdmission(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *MetricsMiddleware) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	var resp *backend.ConversionResponse
	err := m.instrumentPluginRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.BaseHandler.ConvertObjects(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}
