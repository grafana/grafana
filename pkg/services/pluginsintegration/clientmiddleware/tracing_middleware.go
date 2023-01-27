package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
)

// NewTracingMiddleware returns a new middleware that creates a new span on every method call.
func NewTracingMiddleware(tracer tracing.Tracer) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &TracingMiddleware{
			tracer: tracer,
			next:   next,
		}
	})
}

type TracingMiddleware struct {
	tracer tracing.Tracer
	next   plugins.Client
}

func (m *TracingMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctx, span := m.tracer.Start(ctx, "queryData")
	defer span.End()
	return m.next.QueryData(ctx, req)
}

func (m *TracingMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctx, span := m.tracer.Start(ctx, "callResource")
	defer span.End()
	return m.next.CallResource(ctx, req, sender)
}

func (m *TracingMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	ctx, span := m.tracer.Start(ctx, "checkHealth")
	defer span.End()
	return m.next.CheckHealth(ctx, req)
}

func (m *TracingMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	ctx, span := m.tracer.Start(ctx, "collectMetrics")
	defer span.End()
	return m.next.CollectMetrics(ctx, req)
}

func (m *TracingMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	ctx, span := m.tracer.Start(ctx, "subscribeStream")
	defer span.End()
	return m.next.SubscribeStream(ctx, req)
}

func (m *TracingMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	ctx, span := m.tracer.Start(ctx, "publishStream")
	defer span.End()
	return m.next.PublishStream(ctx, req)
}

func (m *TracingMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	ctx, span := m.tracer.Start(ctx, "runStream")
	defer span.End()
	return m.next.RunStream(ctx, req, sender)
}
