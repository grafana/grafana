package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/services/contexthandler"
)

// NewClearAuthHeadersMiddleware creates a new backend.HandlerMiddleware
// that will clear any outgoing HTTP headers that was part of the incoming
// HTTP request and used when authenticating to Grafana.
func NewClearAuthHeadersMiddleware() backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &ClearAuthHeadersMiddleware{
			BaseHandler: backend.NewBaseHandler(next),
		}
	})
}

type ClearAuthHeadersMiddleware struct {
	backend.BaseHandler
}

func (m *ClearAuthHeadersMiddleware) clearHeaders(ctx context.Context, h backend.ForwardHTTPHeaders) {
	reqCtx := contexthandler.FromContext(ctx)
	// if no HTTP request context skip middleware
	if h == nil || reqCtx == nil || reqCtx.Req == nil || reqCtx.SignedInUser == nil {
		return
	}

	list := contexthandler.AuthHTTPHeaderListFromContext(ctx)
	if list != nil {
		for _, k := range list.Items {
			h.DeleteHTTPHeader(k)
		}
	}
}

func (m *ClearAuthHeadersMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	m.clearHeaders(ctx, req)

	return m.BaseHandler.QueryData(ctx, req)
}

func (m *ClearAuthHeadersMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}

	m.clearHeaders(ctx, req)

	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *ClearAuthHeadersMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.BaseHandler.CheckHealth(ctx, req)
	}

	m.clearHeaders(ctx, req)

	return m.BaseHandler.CheckHealth(ctx, req)
}

func (m *ClearAuthHeadersMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if req == nil {
		return m.BaseHandler.SubscribeStream(ctx, req)
	}

	m.clearHeaders(ctx, req)

	return m.BaseHandler.SubscribeStream(ctx, req)
}

func (m *ClearAuthHeadersMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if req == nil {
		return m.BaseHandler.PublishStream(ctx, req)
	}

	m.clearHeaders(ctx, req)

	return m.BaseHandler.PublishStream(ctx, req)
}

func (m *ClearAuthHeadersMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if req == nil {
		return m.BaseHandler.RunStream(ctx, req, sender)
	}

	m.clearHeaders(ctx, req)

	return m.BaseHandler.RunStream(ctx, req, sender)
}
