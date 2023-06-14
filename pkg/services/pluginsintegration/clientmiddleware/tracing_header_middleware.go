package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/query"
)

// NewTracingHeaderMiddleware creates a new plugins.ClientMiddleware that will
// populate useful tracing headers on outgoing plugins.Client and HTTP
// requests.
// Tracing headers are X-Datasource-Uid, X-Dashboard-Uid,
// X-Panel-Id, X-Grafana-Org-Id.
func NewTracingHeaderMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &TracingHeaderMiddleware{
			next: next,
		}
	})
}

type TracingHeaderMiddleware struct {
	next plugins.Client
}

func (m *TracingHeaderMiddleware) applyHeaders(ctx context.Context, req backend.ForwardHTTPHeaders) {
	reqCtx := contexthandler.FromContext(ctx)
	// If no HTTP request context then skip middleware.
	if req == nil || reqCtx == nil || reqCtx.Req == nil {
		return
	}

	var headersList = []string{query.HeaderQueryGroupID, query.HeaderPanelID, query.HeaderDashboardUID, query.HeaderDatasourceUID, query.HeaderFromExpression, `X-Grafana-Org-Id`}

	for _, headerName := range headersList {
		gotVal := reqCtx.Req.Header.Get(headerName)
		if gotVal == "" {
			continue
		}
		req.SetHTTPHeader(headerName, gotVal)
	}
}

func (m *TracingHeaderMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	m.applyHeaders(ctx, req)
	return m.next.QueryData(ctx, req)
}

func (m *TracingHeaderMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return m.next.CallResource(ctx, req, sender)
}

func (m *TracingHeaderMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	m.applyHeaders(ctx, req)
	return m.next.CheckHealth(ctx, req)
}

func (m *TracingHeaderMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *TracingHeaderMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *TracingHeaderMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *TracingHeaderMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}
