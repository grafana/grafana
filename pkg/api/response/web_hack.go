//nolint:unused,deadcode
package response

//NOTE: This file belongs into pkg/web, but due to cyclic imports that are hard to resolve at the current time, it temporarily lives here.

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

type (
	handlerStd       = func(http.ResponseWriter, *http.Request)
	handlerStdCtx    = func(http.ResponseWriter, *http.Request, *web.Context)
	handlerStdReqCtx = func(http.ResponseWriter, *http.Request, *contextmodel.ReqContext)
	handlerReqCtx    = func(*contextmodel.ReqContext)
	handlerReqCtxRes = func(*contextmodel.ReqContext) Response
	handlerCtx       = func(*web.Context)
)

func wrap_handler(h web.Handler) http.HandlerFunc {
	switch handle := h.(type) {
	case http.HandlerFunc:
		return handle
	case handlerStd:
		return handle
	case handlerStdCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(w, r, webCtx(w, r))
		}
	case handlerStdReqCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(w, r, reqCtx(w, r))
		}
	case handlerReqCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(reqCtx(w, r))
		}
	case handlerReqCtxRes:
		return func(w http.ResponseWriter, r *http.Request) {
			ctx := reqCtx(w, r)
			res := handle(ctx)
			if res != nil {
				res.WriteTo(ctx)
			}
		}
	case handlerCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(webCtx(w, r))
		}
	}

	panic(fmt.Sprintf("unexpected handler type: %T", h))
}

func webCtx(w http.ResponseWriter, r *http.Request) *web.Context {
	ctx := web.FromContext(r.Context())
	if ctx == nil {
		panic("no *web.Context found")
	}

	ctx.Req = r
	ctx.Resp = web.Rw(w, r)
	return ctx
}

func reqCtx(w http.ResponseWriter, r *http.Request) *contextmodel.ReqContext {
	wCtx := webCtx(w, r)
	reqCtx, ok := wCtx.Req.Context().Value(ctxkey.Key{}).(*contextmodel.ReqContext)
	if !ok {
		panic("no *contextmodel.ReqContext found")
	}
	return reqCtx
}
