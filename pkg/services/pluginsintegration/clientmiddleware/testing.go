package clientmiddleware

import (
	"context"
	"net/http"
	"net/http/httptest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func WithReqContext(req *http.Request, user *user.SignedInUser) handlertest.HandlerMiddlewareTestOption {
	return handlertest.HandlerMiddlewareTestOption(func(cdt *handlertest.HandlerMiddlewareTest) {
		reqContext := &contextmodel.ReqContext{
			Context: &web.Context{
				Req:  req,
				Resp: web.NewResponseWriter(req.Method, httptest.NewRecorder()),
			},
			SignedInUser: user,
		}

		ctx := ctxkey.Set(req.Context(), reqContext)
		*req = *req.WithContext(ctx)
	})
}

type nopChunkedDataWriter struct {
}

func (n nopChunkedDataWriter) WriteFrame(_ context.Context, _ string, _ string, _ *data.Frame) error {
	return nil
}

func (n nopChunkedDataWriter) WriteError(_ context.Context, _ string, _ backend.Status, _ error) error {
	return nil
}

var nopCallResourceSender = backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
	return nil
})
