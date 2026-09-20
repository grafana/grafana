package web

import "net/http"

// handlerWrapper turns a Grafana handler into an http.HandlerFunc.
// The full implementation lives in internal/web because it depends on API
// response types that import this package. Registering it avoids a
// //go:linkname punch through to an unexported function (broken under
// Go 1.23+ -checklinkname).
type handlerWrapper func(Handler) http.HandlerFunc

var registeredHandlerWrapper handlerWrapper

// SetHandlerWrapper registers the shared handler wrapper.
// It is called from internal/web on init. pkg/web cannot import that package
// without recreating the import cycle the old go:linkname hack existed to skip.
func SetHandlerWrapper(fn func(Handler) http.HandlerFunc) {
	registeredHandlerWrapper = fn
}

func wrapHandler(h Handler) http.Handler {
	if registeredHandlerWrapper != nil {
		return registeredHandlerWrapper(h)
	}
	return defaultWrapHandler(h)
}

type (
	handlerStd    = func(http.ResponseWriter, *http.Request)
	handlerStdCtx = func(http.ResponseWriter, *http.Request, *Context)
	handlerCtx    = func(*Context)
)

// defaultWrapHandler covers handler signatures that pkg/web can wrap without
// importing API packages. ReqContext / response.Response handlers require
// importing github.com/grafana/grafana/internal/web so WrapHandler is registered.
func defaultWrapHandler(h Handler) http.HandlerFunc {
	switch handle := h.(type) {
	case http.HandlerFunc:
		return handle
	case handlerStd:
		return handle
	case handlerStdCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(w, r, mustWebCtx(w, r))
		}
	case handlerCtx:
		return func(w http.ResponseWriter, r *http.Request) {
			handle(mustWebCtx(w, r))
		}
	}

	panic("web handler wrapper is not registered; import github.com/grafana/grafana/internal/web")
}

func mustWebCtx(w http.ResponseWriter, r *http.Request) *Context {
	ctx := FromContext(r.Context())
	if ctx == nil {
		panic("no *web.Context found")
	}
	ctx.Req = r
	ctx.Resp = Rw(w, r)
	return ctx
}
