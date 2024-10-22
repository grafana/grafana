package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/contexthandler"
)

func NewUseAlertHeadersMiddleware() backend.HandlerMiddleware {
	return backend.HandlerMiddlewareFunc(func(next backend.Handler) backend.Handler {
		return &UseAlertHeadersMiddleware{
			BaseHandler: backend.NewBaseHandler(next),
		}
	})
}

type UseAlertHeadersMiddleware struct {
	backend.BaseHandler
}

var alertHeaders = []string{
	"Fromalert",
	"X-Rule-Name",
	"X-Rule-Folder",
	"X-Rule-Source",
	"X-Rule-Type",
	"X-Rule-Version",
}

func applyAlertHeaders(ctx context.Context, req *backend.QueryDataRequest) {
	reqCtx := contexthandler.FromContext(ctx)
	if reqCtx == nil || reqCtx.Req == nil {
		return
	}
	incomingHeaders := reqCtx.Req.Header

	for _, key := range alertHeaders {
		incomingValue := incomingHeaders.Get(key)
		if incomingValue != "" {
			req.SetHTTPHeader(key, incomingValue)
		}
	}

	// datasources check for the "alerting" case by checking
	// req.Headers["FromAlert"]
	// (yes, incorrectly capitalized).
	// so we specially add that one
	// to req.Headers (not to headers-to-forward,
	// that we solved above)
	isFromAlert := incomingHeaders.Get("Fromalert")
	if isFromAlert != "" {
		req.Headers["FromAlert"] = isFromAlert
	}
}

func (m *UseAlertHeadersMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	applyAlertHeaders(ctx, req)
	return m.BaseHandler.QueryData(ctx, req)
}
