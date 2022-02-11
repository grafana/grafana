package routing

import (
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/web"
)

type Router interface {
	Handle(method, pattern string, handlers []web.Handler)
	Get(pattern string, handlers ...web.Handler)
}

// RouteRegister allows you to add routes and web.Handlers
// that the web server should serve.
type RouteRegister interface {
	// Get adds a list of handlers to a given route with a GET HTTP verb
	Get(string, ...web.Handler)

	// Post adds a list of handlers to a given route with a POST HTTP verb
	Post(string, ...web.Handler)

	// Delete adds a list of handlers to a given route with a DELETE HTTP verb
	Delete(string, ...web.Handler)

	// Put adds a list of handlers to a given route with a PUT HTTP verb
	Put(string, ...web.Handler)

	// Patch adds a list of handlers to a given route with a PATCH HTTP verb
	Patch(string, ...web.Handler)

	// Any adds a list of handlers to a given route with any HTTP verb
	Any(string, ...web.Handler)

	// Group allows you to pass a function that can add multiple routes
	// with a shared prefix route.
	Group(string, func(RouteRegister), ...web.Handler)

	// Insert adds more routes to an existing Group.
	Insert(string, func(RouteRegister), ...web.Handler)

	// Register iterates over all routes added to the RouteRegister
	// and add them to the `Router` pass as an parameter.
	Register(Router, ...RegisterNamedMiddleware)

	// Reset resets the route register.
	Reset()
}

type RegisterNamedMiddleware func(name string) web.Handler

func ProvideRegister() *RouteRegisterImpl {
	return NewRouteRegister(middleware.ProvideRouteOperationName)
}

// NewRouteRegister creates a new RouteRegister with all middlewares sent as params
func NewRouteRegister(namedMiddlewares ...RegisterNamedMiddleware) *RouteRegisterImpl {
	return &RouteRegisterImpl{
		prefix:           "",
		routes:           []route{},
		subfixHandlers:   []web.Handler{},
		namedMiddlewares: namedMiddlewares,
	}
}

type route struct {
	method   string
	pattern  string
	handlers []web.Handler
}

type RouteRegisterImpl struct {
	prefix           string
	subfixHandlers   []web.Handler
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

func (rr *RouteRegisterImpl) Insert(pattern string, fn func(RouteRegister), handlers ...web.Handler) {
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

func (rr *RouteRegisterImpl) Group(pattern string, fn func(rr RouteRegister), handlers ...web.Handler) {
	group := &RouteRegisterImpl{
		prefix:           rr.prefix + pattern,
		subfixHandlers:   append(rr.subfixHandlers, handlers...),
		routes:           []route{},
		namedMiddlewares: rr.namedMiddlewares,
	}

	fn(group)
	rr.groups = append(rr.groups, group)
}

func (rr *RouteRegisterImpl) Register(router Router, namedMiddlewares ...RegisterNamedMiddleware) {
	for _, r := range rr.routes {
		// Add global named middlewares
		for i, m := range namedMiddlewares {
			r.handlers = insertHandler(r.handlers, len(rr.namedMiddlewares)+i, m(r.pattern))
		}

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
		g.Register(router, namedMiddlewares...)
	}
}

func (rr *RouteRegisterImpl) route(pattern, method string, handlers ...web.Handler) {
	h := make([]web.Handler, 0)
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

func insertHandler(a []web.Handler, index int, value web.Handler) []web.Handler {
	if len(a) == index {
		return append(a, value)
	}
	a = append(a[:index+1], a[index:]...)
	a[index] = value
	return a
}

func (rr *RouteRegisterImpl) Get(pattern string, handlers ...web.Handler) {
	rr.route(pattern, http.MethodGet, handlers...)
}

func (rr *RouteRegisterImpl) Post(pattern string, handlers ...web.Handler) {
	rr.route(pattern, http.MethodPost, handlers...)
}

func (rr *RouteRegisterImpl) Delete(pattern string, handlers ...web.Handler) {
	rr.route(pattern, http.MethodDelete, handlers...)
}

func (rr *RouteRegisterImpl) Put(pattern string, handlers ...web.Handler) {
	rr.route(pattern, http.MethodPut, handlers...)
}

func (rr *RouteRegisterImpl) Patch(pattern string, handlers ...web.Handler) {
	rr.route(pattern, http.MethodPatch, handlers...)
}

func (rr *RouteRegisterImpl) Any(pattern string, handlers ...web.Handler) {
	rr.route(pattern, "*", handlers...)
}
