package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler"
)

// NewClearAuthHeadersMiddleware creates a new plugins.ClientMiddleware
// that will clear any outgoing HTTP headers that was part of the incoming
// HTTP request and used when authenticating to Grafana.
func NewClearAuthHeadersMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &ClearAuthHeadersMiddleware{
			baseMiddleware: baseMiddleware{
				next: next,
			},
		}
	})
}

type ClearAuthHeadersMiddleware struct {
	baseMiddleware
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
		return m.next.QueryData(ctx, req)
	}

	m.clearHeaders(ctx, req)

	return m.next.QueryData(ctx, req)
}

func (m *ClearAuthHeadersMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	m.clearHeaders(ctx, req)

	return m.next.CallResource(ctx, req, sender)
}

func (m *ClearAuthHeadersMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	m.clearHeaders(ctx, req)

	return m.next.CheckHealth(ctx, req)
}
