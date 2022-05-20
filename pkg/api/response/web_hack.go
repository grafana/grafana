//nolint:unused,deadcode
package response

//NOTE: This file belongs into pkg/web, but due to cyclic imports that are hard to resolve at the current time, it temporarily lives here.

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	"github.com/grafana/grafana/pkg/web"
)

type (
	handlerStd       = func(http.ResponseWriter, *http.Request)
	handlerStdCtx    = func(http.ResponseWriter, *http.Request, *web.Context)
	handlerStdReqCtx = func(http.ResponseWriter, *http.Request, *models.ReqContext)
	handlerReqCtx    = func(*models.ReqContext)
	handlerReqCtxRes = func(*models.ReqContext) Response
	handlerCtx       = func(*web.Context)
)

func wrap_handler(h web.Handler) http.HandlerFunc {
	switch handle := h.(type) {
	case handlerStd:
		return handle
	case handlerStdCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(w, r, web.FromContext(r.Context()))
		}
	case handlerStdReqCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(w, r, getReqCtx(r.Context()))
		}
	case handlerReqCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(getReqCtx(r.Context()))
		}
	case handlerReqCtxRes:
		return func(w http.ResponseWriter, r *http.Request) {
			ctx := getReqCtx(r.Context())
			res := handle(ctx)
			res.WriteTo(ctx)
		}
	case handlerCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(web.FromContext(r.Context()))
		}
	}

	panic(fmt.Sprintf("unexpected handler type: %T", h))
}

func getReqCtx(ctx context.Context) *models.ReqContext {
	reqCtx, ok := ctx.Value(ctxkey.Key{}).(*models.ReqContext)
	if !ok {
		panic("no *models.ReqContext found")
	}
	return reqCtx
}
