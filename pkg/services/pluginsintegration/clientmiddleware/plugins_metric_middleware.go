package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/instrumentation"
)

// NewPluginsMetricMiddleware creates a new plugins.PluginsMetricMiddleware that will
// populate useful metrocs for outgoing plugins.Client and HTTP requests.
func NewPluginsMetricMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &PluginsMetricMiddleware{
			next: next,
		}
	})
}

type PluginsMetricMiddleware struct {
	next plugins.Client
}

func (m *PluginsMetricMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	var totalBytes float64
	for _, v := range req.Queries {
		totalBytes += float64(len(v.JSON))
	}

	instrumentation.InstrumentRequestSize(req.PluginContext.PluginID, instrumentation.EndpointQueryData, "not implemented", totalBytes)

	return m.next.QueryData(ctx, req)
}

func (m *PluginsMetricMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return m.next.CheckHealth(ctx, req)
}

func (m *PluginsMetricMiddleware) SubscribeStream(ctx context.Context, request *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, request)
}

func (m *PluginsMetricMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.
	PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *PluginsMetricMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}

func (m *PluginsMetricMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	totalBytes := float64(len(req.Body))

	instrumentation.InstrumentRequestSize(req.PluginContext.PluginID, instrumentation.EndpointCallResource, "not implemented",
		totalBytes)

	return m.next.CallResource(ctx, req, sender)
}

func (m *PluginsMetricMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}
