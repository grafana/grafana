package web

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	grafanaweb "github.com/grafana/grafana/pkg/web"
)

func init() {
	grafanaweb.SetHandlerWrapper(WrapHandler)
}

type (
	handlerStd       = func(http.ResponseWriter, *http.Request)
	handlerStdCtx    = func(http.ResponseWriter, *http.Request, *grafanaweb.Context)
	handlerStdReqCtx = func(http.ResponseWriter, *http.Request, *contextmodel.ReqContext)
	handlerReqCtx    = func(*contextmodel.ReqContext)
	handlerReqCtxRes = func(*contextmodel.ReqContext) response.Response
	handlerCtx       = func(*grafanaweb.Context)
)

// WrapHandler turns any supported Grafana handler type into an http.HandlerFunc.
func WrapHandler(h grafanaweb.Handler) http.HandlerFunc {
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

func webCtx(w http.ResponseWriter, r *http.Request) *grafanaweb.Context {
	ctx := grafanaweb.FromContext(r.Context())
	if ctx == nil {
		panic("no *web.Context found")
	}

	ctx.Req = r
	ctx.Resp = grafanaweb.Rw(w, r)
	return ctx
}

func reqCtx(w http.ResponseWriter, r *http.Request) *contextmodel.ReqContext {
	wCtx := webCtx(w, r)
	req, ok := wCtx.Req.Context().Value(ctxkey.Key{}).(*contextmodel.ReqContext)
	if !ok {
		panic("no *contextmodel.ReqContext found")
	}
	return req
}
