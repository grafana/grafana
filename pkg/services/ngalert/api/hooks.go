package api

import (
	"net/http"
	"net/url"

	"github.com/gorilla/mux"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type RequestHandlerFunc func(*contextmodel.ReqContext) response.Response

type Hooks struct {
	logger     log.Logger
	router     *mux.Router
	routeHooks map[*mux.Route]RequestHandlerFunc
}

// NewHooks creates an empty set of request handler hooks. Hooks can be used
// to replace handlers for specific paths.
func NewHooks(logger log.Logger) *Hooks {
	return &Hooks{
		logger:     logger,
		router:     mux.NewRouter(),
		routeHooks: make(map[*mux.Route]RequestHandlerFunc),
	}
}

// Add creates a new request hook for a path, causing requests to the path to
// be handled by the hook function, and not the original handler.
func (h *Hooks) Set(method string, path string, hook RequestHandlerFunc) {
	h.logger.Info("Setting hook override for the specified route", "path", path)
	route := h.router.NewRoute().Path(path).Methods(method)
	h.routeHooks[route] = hook
}

// Get returns a hook if one is defined for the matching URL.
// Get also returns a bool indicating whether or not a matching hook exists.
func (h *Hooks) Get(method string, url *url.URL) (RequestHandlerFunc, bool) {
	req := http.Request{Method: method, URL: url}

	match := mux.RouteMatch{}
	if ok := h.router.Match(&req, &match); ok {
		return h.routeHooks[match.Route], ok
	}

	return nil, false
}

// Wrap returns a new handler which will intercept paths with hooks configured,
// and invoke the hooked in handler instead. If no hook is configured for a path,
// then the given handler is invoked.
func (h *Hooks) Wrap(next RequestHandlerFunc) RequestHandlerFunc {
	return func(req *contextmodel.ReqContext) response.Response {
		if hook, ok := h.Get(req.Req.Method, req.Req.URL); ok {
			h.logger.Debug("Hook defined - invoking new handler", "path", req.Req.URL.Path)
			return hook(req)
		}
		return next(req)
	}
}
