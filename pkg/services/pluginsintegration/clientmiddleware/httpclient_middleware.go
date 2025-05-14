package clientmiddleware

import (
	"context"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	ngalertmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const forwardPluginRequestHTTPHeaders = "forward-plugin-request-http-headers"

// NewHTTPClientMiddleware creates a new backend.HandlerMiddleware
// that will forward plugin request headers as outgoing HTTP headers.
func NewHTTPClientMiddleware() backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &HTTPClientMiddleware{
			BaseHandler: backend.NewBaseHandler(next),
		}
	})
}

type HTTPClientMiddleware struct {
	backend.BaseHandler
}

func (m *HTTPClientMiddleware) applyHeaders(ctx context.Context, pReq any) context.Context {
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
					// Only set a header if it is not already set.
					if req.Header.Get(k) == "" {
						req.Header[k] = v
					}
				}
			}

			return next.RoundTrip(req)
		})
	})

	return httpclient.WithContextualMiddleware(ctx, mw)
}

func (m *HTTPClientMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	ctx = m.applyHeaders(ctx, req)

	return m.BaseHandler.QueryData(ctx, req)
}

func (m *HTTPClientMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}

	ctx = m.applyHeaders(ctx, req)

	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *HTTPClientMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.BaseHandler.CheckHealth(ctx, req)
	}

	ctx = m.applyHeaders(ctx, req)

	return m.BaseHandler.CheckHealth(ctx, req)
}
