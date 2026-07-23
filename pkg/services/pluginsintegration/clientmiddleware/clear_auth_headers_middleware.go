package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/setting"
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

	// Strip the auth-header snapshot frozen at request start (see
	// contexthandler.WithAuthHTTPHeaders) so clearing always matches the headers
	// that authenticated this request, regardless of any concurrent reload. When
	// no snapshot is present (request paths that bypass the context handler),
	// fall back to the unconditional auth headers rather than forwarding them.
	items := contexthandler.GetAuthHTTPHeaders(&setting.AuthJWTSettings{}, &setting.AuthProxySettings{})
	if list := contexthandler.AuthHTTPHeaderListFromContext(reqCtx.Req.Context()); list != nil {
		items = list.Items
	}
	for _, k := range items {
		h.DeleteHTTPHeader(k)
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
