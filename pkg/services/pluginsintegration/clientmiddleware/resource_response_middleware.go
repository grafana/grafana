package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

// NewResourceResponseMiddleware creates a new plugins.ClientMiddleware
// that will enforce HTTP header rules for backend.CallResourceResponse's.
func NewResourceResponseMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &ResourceResponseMiddleware{
			next: next,
		}
	})
}

type ResourceResponseMiddleware struct {
	next plugins.Client
}

func (m *ResourceResponseMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return m.next.QueryData(ctx, req)
}

func (m *ResourceResponseMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil || sender == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	processedStreams := 0
	wrappedSender := callResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
		if processedStreams == 0 {
			if res.Headers == nil {
				res.Headers = map[string][]string{}
			}

			proxyutil.SetProxyResponseHeaders(res.Headers)
		}

		processedStreams++
		return sender.Send(res)
	})

	return m.next.CallResource(ctx, req, wrappedSender)
}

func (m *ResourceResponseMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return m.next.CheckHealth(ctx, req)
}

func (m *ResourceResponseMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *ResourceResponseMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *ResourceResponseMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *ResourceResponseMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}
