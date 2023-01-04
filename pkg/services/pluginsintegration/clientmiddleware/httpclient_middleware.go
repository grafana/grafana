package clientmiddleware

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/plugins"
	ngalertmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const forwardPluginRequestHTTPHeaders = "forward-plugin-request-http-headers"

// NewHTTPClientMiddleware creates a new plugins.ClientMiddleware
// that will forward plugin request headers as outgoing HTTP headers.
func NewHTTPClientMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &HTTPClientMiddleware{
			next: next,
		}
	})
}

type HTTPClientMiddleware struct {
	next plugins.Client
}

func (m *HTTPClientMiddleware) applyHeaders(ctx context.Context, pReq interface{}) context.Context {
	if pReq == nil {
		return ctx
	}

	mw := httpclient.NamedMiddlewareFunc(forwardPluginRequestHTTPHeaders, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			switch t := pReq.(type) {
			case *backend.QueryDataRequest:
				if val, exists := t.Headers[ngalertmodels.FromAlertHeaderName]; exists {
					req.Header.Set(ngalertmodels.FromAlertHeaderName, val)
				}
			case *backend.CallResourceRequest:
				if val, exists := t.Headers[ngalertmodels.FromAlertHeaderName]; exists {
					req.Header.Set(ngalertmodels.FromAlertHeaderName, val[0])
				}
			case *backend.CheckHealthRequest:
				if val, exists := t.Headers[ngalertmodels.FromAlertHeaderName]; exists {
					req.Header.Set(ngalertmodels.FromAlertHeaderName, val)
				}
			}

			if h, ok := pReq.(backend.ForwardHTTPHeaders); ok {
				for k, v := range h.GetHTTPHeaders() {
					req.Header[k] = v
				}
			}

			return next.RoundTrip(req)
		})
	})

	return httpclient.WithContextualMiddleware(ctx, mw)
}

func (m *HTTPClientMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	ctx = m.applyHeaders(ctx, req)

	return m.next.QueryData(ctx, req)
}

func (m *HTTPClientMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	ctx = m.applyHeaders(ctx, req)

	return m.next.CallResource(ctx, req, sender)
}

func (m *HTTPClientMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	ctx = m.applyHeaders(ctx, req)

	return m.next.CheckHealth(ctx, req)
}

func (m *HTTPClientMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	return m.next.CollectMetrics(ctx, req)
}

func (m *HTTPClientMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *HTTPClientMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *HTTPClientMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}
