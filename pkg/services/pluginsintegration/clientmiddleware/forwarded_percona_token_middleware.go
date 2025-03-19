package clientmiddleware

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/services/contexthandler"
)

// @PERCONA
const forwardedProxyFilterMiddlewareName = "forwarded-x-proxy-filter"

// NewPerconaForwarderHTTPClientMiddleware creates a new plugins.ClientMiddleware
// that will forward plugin request headers as outgoing HTTP headers.
func NewPerconaForwarderHTTPClientMiddleware() backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &PerconaForwarderHTTPClientMiddleware{
			BaseHandler: backend.NewBaseHandler(next),
		}
	})
}

type PerconaForwarderHTTPClientMiddleware struct {
	backend.BaseHandler
}

func (m *PerconaForwarderHTTPClientMiddleware) applyHeaders(ctx context.Context, pReq *backend.QueryDataRequest) context.Context {
	if pReq == nil {
		return ctx
	}

	mw := httpclient.NamedMiddlewareFunc(forwardedProxyFilterMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			reqCtx := contexthandler.FromContext(ctx)

			if reqCtx != nil && reqCtx.Req != nil && reqCtx.Req.Header != nil {
				xProxyFilter := reqCtx.Req.Header.Get("X-Proxy-Filter")
				if xProxyFilter != "" {
					req.Header.Set("X-Proxy-Filter", xProxyFilter)
				}
			}

			return next.RoundTrip(req)
		})
	})

	return httpclient.WithContextualMiddleware(ctx, mw)
}

func (m *PerconaForwarderHTTPClientMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	ctx = m.applyHeaders(ctx, req)

	return m.BaseHandler.QueryData(ctx, req)
}

func (m *PerconaForwarderHTTPClientMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *PerconaForwarderHTTPClientMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return m.BaseHandler.CheckHealth(ctx, req)
}

func (m *PerconaForwarderHTTPClientMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.BaseHandler.CollectMetrics(ctx, req)
}

func (m *PerconaForwarderHTTPClientMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.BaseHandler.SubscribeStream(ctx, req)
}

func (m *PerconaForwarderHTTPClientMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.BaseHandler.PublishStream(ctx, req)
}

func (m *PerconaForwarderHTTPClientMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.BaseHandler.RunStream(ctx, req, sender)
}
