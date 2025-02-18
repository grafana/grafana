package clientmiddleware

import (
	"context"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

// NewUserHeaderMiddleware creates a new backend.HandlerMiddleware that will
// populate the X-Grafana-User header on outgoing backend.Handler requests.
func NewUserHeaderMiddleware() backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &UserHeaderMiddleware{
			BaseHandler: backend.NewBaseHandler(next),
		}
	})
}

type UserHeaderMiddleware struct {
	backend.BaseHandler
}

func (m *UserHeaderMiddleware) applyUserHeader(ctx context.Context, h backend.ForwardHTTPHeaders) {
	reqCtx := contexthandler.FromContext(ctx)
	// if no HTTP request context skip middleware
	if h == nil || reqCtx == nil || reqCtx.Req == nil || reqCtx.SignedInUser == nil {
		return
	}

	h.DeleteHTTPHeader(proxyutil.UserHeaderName)
	if !reqCtx.SignedInUser.IsIdentityType(claims.TypeAnonymous) {
		h.SetHTTPHeader(proxyutil.UserHeaderName, reqCtx.SignedInUser.GetLogin())
	}
}

func (m *UserHeaderMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.BaseHandler.QueryData(ctx, req)
	}

	m.applyUserHeader(ctx, req)

	return m.BaseHandler.QueryData(ctx, req)
}

func (m *UserHeaderMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.BaseHandler.CallResource(ctx, req, sender)
	}

	m.applyUserHeader(ctx, req)

	return m.BaseHandler.CallResource(ctx, req, sender)
}

func (m *UserHeaderMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.BaseHandler.CheckHealth(ctx, req)
	}

	m.applyUserHeader(ctx, req)

	return m.BaseHandler.CheckHealth(ctx, req)
}
