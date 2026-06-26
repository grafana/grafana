package clientmiddleware

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	ngalertmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
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
	"X-Rule-Name",
	"X-Rule-Uid",
	"X-Rule-Folder",
	"X-Rule-Source",
	"X-Rule-Type",
	"X-Rule-Version",
	ngalertmodels.FromAlertHeaderName,
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
			// FromAlert must be set directly, because we need
			// to keep the incorrect capitalization for backwards-compatibility
			// reasons. otherwise Go would normalize it to "Fromalert"
			if key == ngalertmodels.FromAlertHeaderName {
				req.Headers[key] = incomingValue
			} else {
				req.SetHTTPHeader(key, incomingValue)
			}
		}
	}
}

func (m *UseAlertHeadersMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	applyAlertHeaders(ctx, req)
	return m.BaseHandler.QueryData(ctx, req)
}
