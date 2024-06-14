package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler"
)

// NewDatasourceAuthorizationMiddleware creates a new plugins.ClientMiddleware that will
// forward incoming datasource authorization HTTP request header to outgoing plugins.Client requests
func NewDatasourceAuthorizationMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &DatasourceAuthorizationMiddleware{
			baseMiddleware: baseMiddleware{
				next: next,
			},
		}
	})
}

type DatasourceAuthorizationMiddleware struct {
	baseMiddleware
}

func (m *DatasourceAuthorizationMiddleware) applyAuthorizationHeader(ctx context.Context, req backend.ForwardHTTPHeaders) {
	reqCtx := contexthandler.FromContext(ctx)
	// If no HTTP request context then skip middleware.
	if req == nil || reqCtx == nil || reqCtx.Req == nil {
		return
	}

	dsAuthHeader, dsAuthHeaderValue := reqCtx.GetDsAuthorization()
	if dsAuthHeaderValue != "" {
		req.SetHTTPHeader(dsAuthHeader, dsAuthHeaderValue)
	}
	return
}

func (m *DatasourceAuthorizationMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	m.applyAuthorizationHeader(ctx, req)
	return m.next.QueryData(ctx, req)
}

func (m *DatasourceAuthorizationMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	m.applyAuthorizationHeader(ctx, req)
	return m.next.CallResource(ctx, req, sender)
}

func (m *DatasourceAuthorizationMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	m.applyAuthorizationHeader(ctx, req)
	return m.next.CheckHealth(ctx, req)
}
