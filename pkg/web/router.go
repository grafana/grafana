// Copyright 2014 The Macaron Authors
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package web

import (
	"net/http"
	"strings"
	"sync"
)

var (
	// Known HTTP methods.
	_HTTP_METHODS = map[string]bool{
		"GET":     true,
		"POST":    true,
		"PUT":     true,
		"DELETE":  true,
		"PATCH":   true,
		"OPTIONS": true,
		"HEAD":    true,
	}
)

// routeMap represents a thread-safe map for route tree.
type routeMap struct {
	lock   sync.RWMutex
	routes map[string]map[string]*Leaf
}

// NewRouteMap initializes and returns a new routeMap.
func newRouteMap() *routeMap {
	rm := &routeMap{
		routes: make(map[string]map[string]*Leaf),
	}
	for m := range _HTTP_METHODS {
		rm.routes[m] = make(map[string]*Leaf)
	}
	return rm
}

// getLeaf returns Leaf object if a route has been registered.
func (rm *routeMap) getLeaf(method, pattern string) *Leaf {
	rm.lock.RLock()
	defer rm.lock.RUnlock()

	return rm.routes[method][pattern]
}

// add adds new route to route tree map.
func (rm *routeMap) add(method, pattern string, leaf *Leaf) {
	rm.lock.Lock()
	defer rm.lock.Unlock()

	rm.routes[method][pattern] = leaf
}

type group struct {
	pattern  string
	handlers []Handler
}

// Router represents a Macaron router layer.
type Router struct {
	m       *Macaron
	routers map[string]*Tree
	*routeMap
	namedRoutes map[string]*Leaf

	groups   []group
	notFound http.HandlerFunc
}

func NewRouter() *Router {
	return &Router{
		routers:     make(map[string]*Tree),
		routeMap:    newRouteMap(),
		namedRoutes: make(map[string]*Leaf),
	}
}

// Handle is a function that can be registered to a route to handle HTTP requests.
// Like http.HandlerFunc, but has a third parameter for the values of wildcards (variables).
type Handle func(http.ResponseWriter, *http.Request, map[string]string)

// handle adds new route to the router tree.
func (r *Router) handle(method, pattern string, handle Handle) {
	method = strings.ToUpper(method)

	var leaf *Leaf
	// Prevent duplicate routes.
	if leaf = r.getLeaf(method, pattern); leaf != nil {
		return
	}

	// Validate HTTP methods.
	if !_HTTP_METHODS[method] && method != "*" {
		panic("unknown HTTP method: " + method)
	}

	// Generate methods need register.
	methods := make(map[string]bool)
	if method == "*" {
		for m := range _HTTP_METHODS {
			methods[m] = true
		}
	} else {
		methods[method] = true
	}

	// Add to router tree.
	for m := range methods {
		if t, ok := r.routers[m]; ok {
			leaf = t.Add(pattern, handle)
		} else {
			t := NewTree()
			leaf = t.Add(pattern, handle)
			r.routers[m] = t
		}
		r.add(m, pattern, leaf)
	}
}

// Handle registers a new request handle with the given pattern, method and handlers.
func (r *Router) Handle(method string, pattern string, handlers []Handler) {
	if len(r.groups) > 0 {
		groupPattern := ""
		h := make([]Handler, 0)
		for _, g := range r.groups {
			groupPattern += g.pattern
			h = append(h, g.handlers...)
		}

		pattern = groupPattern + pattern
		h = append(h, handlers...)
		handlers = h
	}

	r.handle(method, pattern, func(resp http.ResponseWriter, req *http.Request, params map[string]string) {
		c := r.m.createContext(resp, SetURLParams(req, params))
		for _, h := range handlers {
			c.mws = append(c.mws, mwFromHandler(h))
		}
		c.run()
	})
}

func (r *Router) Group(pattern string, fn func(), h ...Handler) {
	r.groups = append(r.groups, group{pattern, h})
	fn()
	r.groups = r.groups[:len(r.groups)-1]
}

// Get is a shortcut for r.Handle("GET", pattern, handlers)
func (r *Router) Get(pattern string, h ...Handler) {
	r.Handle("GET", pattern, h)
	r.Head(pattern, h...)
}

// Patch is a shortcut for r.Handle("PATCH", pattern, handlers)
func (r *Router) Patch(pattern string, h ...Handler) { r.Handle("PATCH", pattern, h) }

// Post is a shortcut for r.Handle("POST", pattern, handlers)
func (r *Router) Post(pattern string, h ...Handler) { r.Handle("POST", pattern, h) }

// Put is a shortcut for r.Handle("PUT", pattern, handlers)
func (r *Router) Put(pattern string, h ...Handler) { r.Handle("PUT", pattern, h) }

// Delete is a shortcut for r.Handle("DELETE", pattern, handlers)
func (r *Router) Delete(pattern string, h ...Handler) { r.Handle("DELETE", pattern, h) }

// Options is a shortcut for r.Handle("OPTIONS", pattern, handlers)
func (r *Router) Options(pattern string, h ...Handler) { r.Handle("OPTIONS", pattern, h) }

// Head is a shortcut for r.Handle("HEAD", pattern, handlers)
func (r *Router) Head(pattern string, h ...Handler) { r.Handle("HEAD", pattern, h) }

// Any is a shortcut for r.Handle("*", pattern, handlers)
func (r *Router) Any(pattern string, h ...Handler) { r.Handle("*", pattern, h) }

// NotFound configurates http.HandlerFunc which is called when no matching route is
// found. If it is not set, http.NotFound is used.
// Be sure to set 404 response code in your handler.
func (r *Router) NotFound(handlers ...Handler) {
	r.notFound = func(rw http.ResponseWriter, req *http.Request) {
		c := r.m.createContext(rw, req)
		for _, h := range handlers {
			c.mws = append(c.mws, mwFromHandler(h))
		}
		c.run()
	}
}

func (r *Router) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	if t, ok := r.routers[req.Method]; ok {
		// Fast match for static routes
		if !strings.ContainsAny(req.URL.Path, ":*") {
			leaf := r.getLeaf(req.Method, req.URL.Path)
			if leaf != nil {
				leaf.handle(rw, req, nil)
				return
			}
		}

		h, p, ok := t.Match(req.URL.EscapedPath())
		if ok {
			if splat, ok := p["*0"]; ok {
				p["*"] = splat // Easy name.
			}
			h(rw, req, p)
			return
		}
	}

	r.notFound(rw, req)
}
