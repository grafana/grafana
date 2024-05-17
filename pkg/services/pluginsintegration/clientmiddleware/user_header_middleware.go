package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

// NewUserHeaderMiddleware creates a new plugins.ClientMiddleware that will
// populate the X-Grafana-User header on outgoing plugins.Client requests.
func NewUserHeaderMiddleware() plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &UserHeaderMiddleware{
			baseMiddleware: baseMiddleware{
				next: next,
			},
		}
	})
}

type UserHeaderMiddleware struct {
	baseMiddleware
}

func (m *UserHeaderMiddleware) applyUserHeader(ctx context.Context, h backend.ForwardHTTPHeaders) {
	reqCtx := contexthandler.FromContext(ctx)
	// if no HTTP request context skip middleware
	if h == nil || reqCtx == nil || reqCtx.Req == nil || reqCtx.SignedInUser == nil {
		return
	}

	h.DeleteHTTPHeader(proxyutil.UserHeaderName)
	namespace, _ := reqCtx.SignedInUser.GetNamespacedID()
	if namespace != identity.NamespaceAnonymous {
		h.SetHTTPHeader(proxyutil.UserHeaderName, reqCtx.SignedInUser.GetLogin())
	}
}

func (m *UserHeaderMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	m.applyUserHeader(ctx, req)

	return m.next.QueryData(ctx, req)
}

func (m *UserHeaderMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	m.applyUserHeader(ctx, req)

	return m.next.CallResource(ctx, req, sender)
}

func (m *UserHeaderMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	m.applyUserHeader(ctx, req)

	return m.next.CheckHealth(ctx, req)
}
