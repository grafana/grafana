package api

import (
	"net/http"

	macaron "gopkg.in/macaron.v1"
)

type Router interface {
	Route(pattern, method string, handlers ...macaron.Handler)
}

type RouteRegister interface {
	Get(string, ...macaron.Handler)
	Post(string, ...macaron.Handler)
	Delete(string, ...macaron.Handler)
	Put(string, ...macaron.Handler)

	Group(string, func(RouteRegister), ...macaron.Handler)

	Register(Router)
}

func newRouteRegister() RouteRegister {
	return &routeRegister{
		prefix:         "",
		routes:         []route{},
		subfixHandlers: []macaron.Handler{},
	}
}

type route struct {
	method   string
	pattern  string
	handlers []macaron.Handler
}

type routeRegister struct {
	prefix         string
	subfixHandlers []macaron.Handler
	routes         []route
	groups         []*routeRegister
}

func (rr *routeRegister) Group(pattern string, fn func(rr RouteRegister), handlers ...macaron.Handler) {
	group := &routeRegister{
		prefix:         rr.prefix + pattern,
		subfixHandlers: append(rr.subfixHandlers, handlers...),
		routes:         []route{},
	}

	fn(group)
	rr.groups = append(rr.groups, group)
}

func (rr *routeRegister) Register(router Router) {
	for _, r := range rr.routes {
		router.Route(r.pattern, r.method, r.handlers...)
	}

	for _, g := range rr.groups {
		g.Register(router)
	}
}

func (rr *routeRegister) route(pattern, method string, handlers ...macaron.Handler) {
	rr.routes = append(rr.routes, route{
		method:   method,
		pattern:  rr.prefix + pattern,
		handlers: append(rr.subfixHandlers, handlers...),
	})
}

func (rr *routeRegister) Get(pattern string, handlers ...macaron.Handler) {
	rr.route(pattern, http.MethodGet, handlers...)
}

func (rr *routeRegister) Post(pattern string, handlers ...macaron.Handler) {
	rr.route(pattern, http.MethodPost, handlers...)
}

func (rr *routeRegister) Delete(pattern string, handlers ...macaron.Handler) {
	rr.route(pattern, http.MethodDelete, handlers...)
}

func (rr *routeRegister) Put(pattern string, handlers ...macaron.Handler) {
	rr.route(pattern, http.MethodPut, handlers...)
}
