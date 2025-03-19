package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/query"
)

// NewTracingHeaderMiddleware creates a new backend.HandlerMiddleware that will
// populate useful tracing headers on outgoing backend.Handler and HTTP
// requests.
// Tracing headers are X-Datasource-Uid, X-Dashboard-Uid,
// X-Panel-Id, X-Grafana-Org-Id.
func NewTracingHeaderMiddleware() backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &TracingHeaderMiddleware{
			BaseHandler: backend.NewBaseHandler(next),
		}
	})
}

type TracingHeaderMiddleware struct {
	backend.BaseHandler
}

func (m *TracingHeaderMiddleware) applyHeaders(ctx context.Context, req backend.ForwardHTTPHeaders) {
	reqCtx := contexthandler.FromContext(ctx)
	// If no HTTP request context then skip middleware.
	if req == nil || reqCtx == nil || reqCtx.Req == nil {
		return
	}

	var headersList = []string{query.HeaderQueryGroupID, query.HeaderPanelID, query.HeaderDashboardUID, query.HeaderDatasourceUID, query.HeaderFromExpression, `X-Grafana-Org-Id`, query.HeaderPanelPluginId}

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
		return m.BaseHandler.QueryData(ctx, req)
	}

	m.applyHeaders(ctx, req)
	return m.BaseHandler.QueryData(ctx, req)
}

func (m *TracingHeaderMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *TracingHeaderMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.BaseHandler.CheckHealth(ctx, req)
	}

	m.applyHeaders(ctx, req)
	return m.BaseHandler.CheckHealth(ctx, req)
}

func (m *TracingHeaderMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if req == nil {
		return m.BaseHandler.SubscribeStream(ctx, req)
	}

	m.applyHeaders(ctx, req)
	return m.BaseHandler.SubscribeStream(ctx, req)
}

func (m *TracingHeaderMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if req == nil {
		return m.BaseHandler.PublishStream(ctx, req)
	}

	m.applyHeaders(ctx, req)
	return m.BaseHandler.PublishStream(ctx, req)
}

func (m *TracingHeaderMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if req == nil {
		return m.BaseHandler.RunStream(ctx, req, sender)
	}

	m.applyHeaders(ctx, req)
	return m.BaseHandler.RunStream(ctx, req, sender)
}
