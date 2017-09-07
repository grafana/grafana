package api

import (
	"net/http"

	macaron "gopkg.in/macaron.v1"
)

type RouteRegister interface {
	Get(string, ...macaron.Handler)
	Post(string, ...macaron.Handler)
	Delete(string, ...macaron.Handler)
	Put(string, ...macaron.Handler)
	Group(string, func(RouteRegister), ...macaron.Handler)
}

func newRouteRegister(rr *macaron.Router) RouteRegister {
	return &routeRegister{
		prefix: "",
		routes: []route{},
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
}

func (rr *routeRegister) Group(pattern string, fn func(rr RouteRegister), handlers ...macaron.Handler) {
	group := &routeRegister{
		prefix:         rr.prefix + pattern,
		subfixHandlers: handlers,
		routes:         rr.routes,
	}

	fn(group)
}

func (rr *routeRegister) Get(pattern string, handlers ...macaron.Handler) {
	rr.routes = append(rr.routes, route{
		method:   http.MethodGet,
		pattern:  rr.prefix + pattern,
		handlers: handlers,
	})
	println("get: get ", len(rr.routes))
	rr.routes = rr.routes[:len(rr.routes)-1]
}

func (rr *routeRegister) Post(pattern string, handlers ...macaron.Handler) {
	rr.routes = append(rr.routes, route{
		method:   http.MethodPost,
		pattern:  rr.prefix + pattern,
		handlers: handlers,
	})
	println("get: post ", len(rr.routes))

	rr.routes = rr.routes[:len(rr.routes)-1]
}

func (rr *routeRegister) Delete(pattern string, handlers ...macaron.Handler) {
	rr.routes = append(rr.routes, route{
		method:   http.MethodDelete,
		pattern:  rr.prefix + pattern,
		handlers: handlers,
	})
	println("get: delete ", len(rr.routes))

	rr.routes = rr.routes[:len(rr.routes)-1]
}

func (rr *routeRegister) Put(pattern string, handlers ...macaron.Handler) {
	rr.routes = append(rr.routes, route{
		method:   http.MethodPut,
		pattern:  rr.prefix + pattern,
		handlers: handlers,
	})

	rr.routes = rr.routes[:len(rr.routes)-1]
}
