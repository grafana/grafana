package hack

import (
	"fmt"
	"net/http"

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
			handle(contexthandler.FromContext(r.Context()))
			panic("what do do with this response.Response?")
		}
	case HandlerCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(web.FromContext(r.Context()))
		}
	}

	panic(fmt.Sprintf("unexpected handler type: %T", h))
}
