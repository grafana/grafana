package hack

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/web"
)

type (
	HandlerStd       = func(http.ResponseWriter, *http.Request)
	HandlerStdCtx    = func(http.ResponseWriter, *http.Request, *web.Context)
	HandlerReqCtx    = func(*models.ReqContext)
	HandlerReqCtxRes = func(*models.ReqContext) response.Response
	HandlerCtx       = func(*web.Context)
)

func Wrap(h web.Handler) http.HandlerFunc {
	switch handle := h.(type) {
	case HandlerStd:
		return handle
	case HandlerStdCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(w, r, web.FromContext(r.Context()))
		}
	case HandlerReqCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(contexthandler.FromContext(r.Context()))
		}
	case HandlerReqCtxRes:
		return func(w http.ResponseWriter, r *http.Request) {
			ctx := contexthandler.FromContext(r.Context())
			res := handle(ctx)
			res.WriteTo(ctx)
		}
	case HandlerCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(web.FromContext(r.Context()))
		}
	}

	panic(fmt.Sprintf("unexpected handler type: %T", h))
}

func HandlerType(h web.Handler) string {
	switch h.(type) {
	case HandlerStd:
		return "HandlerStd"
	case HandlerStdCtx:
		return "HandlerStdCtx"
	case HandlerReqCtx:
		return "HandlerReqCtx"
	case HandlerReqCtxRes:
		return "HandlerReqCtxRes"
	case HandlerCtx:
		return "HandlerCtx"
	}

	return "Unknown"
}

const EnvHandlerSummary = "HANDLER_SUMMARY"

func Summary(method, route string, handlers []web.Handler) string {
	out := new(strings.Builder)
	fmt.Fprintf(out, "%s %s:\n", method, route)
	for _, h := range handlers {
		fmt.Fprintf(out, "\t%s\n", HandlerType(h))
	}
	return out.String()
}
