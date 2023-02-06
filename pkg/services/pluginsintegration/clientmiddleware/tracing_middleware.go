package clientmiddleware

import (
	"context"

	"go.opentelemetry.io/otel/codes"
	
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

func (m *TracingMiddleware) traceWrap(ctx context.Context, opName string) (context.Context, func(error)) {
	ctx, span := m.tracer.Start(ctx, opName)
	return ctx, func(err error) {
		span.End()
		if err != nil {
			span.SetStatus(codes.Error, opName+" error")
			span.RecordError(err)
		}
	}
}

func (m *TracingMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctx, end := m.traceWrap(ctx, "queryData")
	resp, err := m.next.QueryData(ctx, req)
	end(err)
	return resp, err
}

func (m *TracingMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctx, end := m.traceWrap(ctx, "callResource")
	err := m.next.CallResource(ctx, req, sender)
	end(err)
	return err
}

func (m *TracingMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	ctx, end := m.traceWrap(ctx, "checkHealth")
	resp, err := m.next.CheckHealth(ctx, req)
	end(err)
	return resp, err
}

func (m *TracingMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	ctx, end := m.traceWrap(ctx, "collectMetrics")
	resp, err := m.next.CollectMetrics(ctx, req)
	end(err)
	return resp, err
}

func (m *TracingMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	ctx, end := m.traceWrap(ctx, "subscribeStream")
	resp, err := m.next.SubscribeStream(ctx, req)
	end(err)
	return resp, err
}

func (m *TracingMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	ctx, end := m.traceWrap(ctx, "publishStream")
	resp, err := m.next.PublishStream(ctx, req)
	end(err)
	return resp, err
}

func (m *TracingMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	ctx, end := m.traceWrap(ctx, "runStream")
	err := m.next.RunStream(ctx, req, sender)
	end(err)
	return err
}
