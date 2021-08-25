package routing

import (
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/macaron.v1"
)

type Router interface {
	Handle(method, pattern string, handlers []macaron.Handler) *macaron.Route
	Get(pattern string, handlers ...macaron.Handler) *macaron.Route
}

// RouteRegister allows you to add routes and macaron.Handlers
// that the web server should serve.
type RouteRegister interface {
	// Get adds a list of handlers to a given route with a GET HTTP verb
	Get(string, ...macaron.Handler)

	// Post adds a list of handlers to a given route with a POST HTTP verb
	Post(string, ...macaron.Handler)

	// Delete adds a list of handlers to a given route with a DELETE HTTP verb
	Delete(string, ...macaron.Handler)

	// Put adds a list of handlers to a given route with a PUT HTTP verb
	Put(string, ...macaron.Handler)

	// Patch adds a list of handlers to a given route with a PATCH HTTP verb
	Patch(string, ...macaron.Handler)

	// Any adds a list of handlers to a given route with any HTTP verb
	Any(string, ...macaron.Handler)

	// Group allows you to pass a function that can add multiple routes
	// with a shared prefix route.
	Group(string, func(RouteRegister), ...macaron.Handler)

	// Insert adds more routes to an existing Group.
	Insert(string, func(RouteRegister), ...macaron.Handler)

	// Register iterates over all routes added to the RouteRegister
	// and add them to the `Router` pass as an parameter.
	Register(Router)

	// Reset resets the route register.
	Reset()
}

type RegisterNamedMiddleware func(name string) macaron.Handler

func ProvideRegister(cfg *setting.Cfg) *RouteRegisterImpl {
	return NewRouteRegister(middleware.ProvideRouteOperationName, middleware.RequestMetrics(cfg))
}

// NewRouteRegister creates a new RouteRegister with all middlewares sent as params
func NewRouteRegister(namedMiddlewares ...RegisterNamedMiddleware) *RouteRegisterImpl {
	return &RouteRegisterImpl{
		prefix:           "",
		routes:           []route{},
		subfixHandlers:   []macaron.Handler{},
		namedMiddlewares: namedMiddlewares,
	}
}

type route struct {
	method   string
	pattern  string
	handlers []macaron.Handler
}

type RouteRegisterImpl struct {
	prefix           string
	subfixHandlers   []macaron.Handler
	namedMiddlewares []RegisterNamedMiddleware
	routes           []route
	groups           []*RouteRegisterImpl
}

func (rr *RouteRegisterImpl) Reset() {
	if rr == nil {
		return
	}

	rr.routes = nil
	rr.groups = nil
	rr.subfixHandlers = nil
}

func (rr *RouteRegisterImpl) Insert(pattern string, fn func(RouteRegister), handlers ...macaron.Handler) {
	// loop over all groups at current level
	for _, g := range rr.groups {
		// apply routes if the prefix matches the pattern
		if g.prefix == pattern {
			g.Group("", fn)
			break
		}

		// go down one level if the prefix can be find in the pattern
		if strings.HasPrefix(pattern, g.prefix) {
			g.Insert(pattern, fn)
		}
	}
}

func (rr *RouteRegisterImpl) Group(pattern string, fn func(rr RouteRegister), handlers ...macaron.Handler) {
	group := &RouteRegisterImpl{
		prefix:           rr.prefix + pattern,
		subfixHandlers:   append(rr.subfixHandlers, handlers...),
		routes:           []route{},
		namedMiddlewares: rr.namedMiddlewares,
	}

	fn(group)
	rr.groups = append(rr.groups, group)
}

func (rr *RouteRegisterImpl) Register(router Router) {
	for _, r := range rr.routes {
		// GET requests have to be added to macaron routing using Get()
		// Otherwise HEAD requests will not be allowed.
		// https://github.com/go-macaron/macaron/blob/a325110f8b392bce3e5cdeb8c44bf98078ada3be/router.go#L198
		if r.method == http.MethodGet {
			router.Get(r.pattern, r.handlers...)
		} else {
			router.Handle(r.method, r.pattern, r.handlers)
		}
	}

	for _, g := range rr.groups {
		g.Register(router)
	}
}

func (rr *RouteRegisterImpl) route(pattern, method string, handlers ...macaron.Handler) {
	h := make([]macaron.Handler, 0)
	fullPattern := rr.prefix + pattern

	for _, fn := range rr.namedMiddlewares {
		h = append(h, fn(fullPattern))
	}

	h = append(h, rr.subfixHandlers...)
	h = append(h, handlers...)

	for _, r := range rr.routes {
		if r.pattern == fullPattern && r.method == method {
			panic("cannot add duplicate route")
		}
	}

	rr.routes = append(rr.routes, route{
		method:   method,
		pattern:  fullPattern,
		handlers: h,
	})
}

func (rr *RouteRegisterImpl) Get(pattern string, handlers ...macaron.Handler) {
	rr.route(pattern, http.MethodGet, handlers...)
}

func (rr *RouteRegisterImpl) Post(pattern string, handlers ...macaron.Handler) {
	rr.route(pattern, http.MethodPost, handlers...)
}

func (rr *RouteRegisterImpl) Delete(pattern string, handlers ...macaron.Handler) {
	rr.route(pattern, http.MethodDelete, handlers...)
}

func (rr *RouteRegisterImpl) Put(pattern string, handlers ...macaron.Handler) {
	rr.route(pattern, http.MethodPut, handlers...)
}

func (rr *RouteRegisterImpl) Patch(pattern string, handlers ...macaron.Handler) {
	rr.route(pattern, http.MethodPatch, handlers...)
}

func (rr *RouteRegisterImpl) Any(pattern string, handlers ...macaron.Handler) {
	rr.route(pattern, "*", handlers...)
}
