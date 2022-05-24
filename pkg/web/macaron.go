//go:build go1.3
// +build go1.3

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

// Package macaron is a high productive and modular web framework in Go.
package web

import (
	_ "unsafe"

	"context"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
)

const _VERSION = "1.3.4.0805"

const (
	DEV  = "development"
	PROD = "production"
)

var (
	// Env is the environment that Macaron is executing in.
	// The MACARON_ENV is read on initialization to set this variable.
	Env = DEV
)

func Version() string {
	return _VERSION
}

// Handler can be any callable function.
// Macaron attempts to inject services into the handler's argument list,
// and panics if an argument could not be fulfilled via dependency injection.
type Handler interface{}

//go:linkname hack_wrap github.com/grafana/grafana/pkg/api/response.wrap_handler
func hack_wrap(Handler) http.HandlerFunc

// validateAndWrapHandler makes sure a handler is a callable function, it panics if not.
// When the handler is also potential to be any built-in inject.FastInvoker,
// it wraps the handler automatically to have some performance gain.
func validateAndWrapHandler(h Handler) Handler {
	return hack_wrap(h)
}

// validateAndWrapHandlers preforms validation and wrapping for each input handler.
// It accepts an optional wrapper function to perform custom wrapping on handlers.
func validateAndWrapHandlers(handlers []Handler) []Handler {
	wrappedHandlers := make([]Handler, len(handlers))
	for i, h := range handlers {
		wrappedHandlers[i] = validateAndWrapHandler(h)
	}

	return wrappedHandlers
}

// Macaron represents the top level web application.
// Injector methods can be invoked to map services on a global level.
type Macaron struct {
	handlers []Handler

	urlPrefix string // For suburl support.
	*Router
}

// New creates a bare bones Macaron instance.
// Use this method if you want to have full control over the middleware that is used.
func New() *Macaron {
	m := &Macaron{Router: NewRouter()}
	m.Router.m = m
	m.NotFound(http.NotFound)
	return m
}

// BeforeHandler represents a handler executes at beginning of every request.
// Macaron stops future process when it returns true.
type BeforeHandler func(rw http.ResponseWriter, req *http.Request) bool

// macaronContextKey is used to store/fetch web.Context inside context.Context
type macaronContextKey struct{}

// FromContext returns the macaron context stored in a context.Context, if any.
func FromContext(c context.Context) *Context {
	if mc, ok := c.Value(macaronContextKey{}).(*Context); ok {
		return mc
	}
	return nil
}

type paramsKey struct{}

// Params returns the named route parameters for the current request, if any.
func Params(r *http.Request) map[string]string {
	if rv := r.Context().Value(paramsKey{}); rv != nil {
		return rv.(map[string]string)
	}
	return map[string]string{}
}

// SetURLParams sets the named URL parameters for the given request. This should only be used for testing purposes.
func SetURLParams(r *http.Request, vars map[string]string) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), paramsKey{}, vars))
}

// UseMiddleware is a traditional approach to writing middleware in Go.
// A middleware is a function that has a reference to the next handler in the chain
// and returns the actual middleware handler, that may do its job and optionally
// call next.
// Due to how Macaron handles/injects requests and responses we patch the web.Context
// to use the new ResponseWriter and http.Request here. The caller may only call
// `next.ServeHTTP(rw, req)` to pass a modified response writer and/or a request to the
// further middlewares in the chain.
func (m *Macaron) UseMiddleware(middleware func(http.Handler) http.Handler) {
	next := http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		c := FromContext(req.Context())
		c.Req = req
		if mrw, ok := rw.(*responseWriter); ok {
			c.Resp = mrw
		} else {
			c.Resp = NewResponseWriter(req.Method, rw)
		}
		c.Map(req)
		c.MapTo(rw, (*http.ResponseWriter)(nil))
		c.Next()
	})
	m.handlers = append(m.handlers, Handler(middleware(next)))
}

// Use adds a middleware Handler to the stack,
// and panics if the handler is not a callable func.
// Middleware Handlers are invoked in the order that they are added.
func (m *Macaron) Use(handler Handler) {
	handler = validateAndWrapHandler(handler)
	m.handlers = append(m.handlers, handler)
}

func (m *Macaron) createContext(rw http.ResponseWriter, req *http.Request) *Context {
	c := &Context{
		Injector: NewInjector(),
		handlers: m.handlers,
		index:    0,
		Router:   m.Router,
		Resp:     NewResponseWriter(req.Method, rw),
		logger:   log.New("macaron.context"),
	}
	req = req.WithContext(context.WithValue(req.Context(), macaronContextKey{}, c))
	c.Map(c)
	c.MapTo(c.Resp, (*http.ResponseWriter)(nil))
	c.Map(req)
	c.Req = req
	return c
}

// ServeHTTP is the HTTP Entry point for a Macaron instance.
// Useful if you want to control your own HTTP server.
// Be aware that none of middleware will run without registering any router.
func (m *Macaron) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	req.URL.Path = strings.TrimPrefix(req.URL.Path, m.urlPrefix)
	m.Router.ServeHTTP(rw, req)
}

// SetURLPrefix sets URL prefix of router layer, so that it support suburl.
func (m *Macaron) SetURLPrefix(prefix string) {
	m.urlPrefix = prefix
}
