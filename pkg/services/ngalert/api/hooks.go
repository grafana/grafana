package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type RequestHandlerFunc func(*contextmodel.ReqContext) response.Response

type Hooks struct {
	hooks map[string]RequestHandlerFunc
}

// NewHooks creates an empty set of request handler hooks. Hooks can be used
// to replace handlers for specific paths.
func NewHooks() *Hooks {
	return &Hooks{
		hooks: make(map[string]RequestHandlerFunc),
	}
}

// Add creates a new request hook for a path, causing requests to the path to
// be handled by the hook function, and not the original handler.
func (h *Hooks) Set(path string, hook RequestHandlerFunc) {
	h.hooks[path] = hook
}

// Wrap returns a new handler which will intercept paths with hooks configured,
// and invoke the hooked in handler instead. If no hook is configured for a path,
// then the given handler is invoked.
func (h *Hooks) Wrap(next RequestHandlerFunc) RequestHandlerFunc {
	return func(req *contextmodel.ReqContext) response.Response {
		if hook, ok := h.hooks[req.Context.Req.URL.Path]; ok {
			return hook(req)
		}
		return next(req)
	}
}
