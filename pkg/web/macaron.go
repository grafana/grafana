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
	"context"
	"net/http"
	"strings"
	_ "unsafe"
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
type Handler any

//go:linkname hack_wrap github.com/grafana/grafana/pkg/api/response.wrap_handler
func hack_wrap(Handler) http.HandlerFunc

// wrapHandler turns any supported handler type into a http.Handler by wrapping it accordingly
func wrapHandler(h Handler) http.Handler {
	return hack_wrap(h)
}

// Macaron represents the top level web application.
// Injector methods can be invoked to map services on a global level.
type Macaron struct {
	// handlers    []http.Handler
	mws []Middleware

	urlPrefix string // For suburl support.
	*Router
}

// New creates a bare bones Macaron instance.
// Use this method if you want to have full control over the middleware that is used.
func New() *Macaron {
	m := &Macaron{Router: NewRouter()}
	m.m = m
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

type Middleware = func(next http.Handler) http.Handler

// UseMiddleware registers the given Middleware
func (m *Macaron) UseMiddleware(mw Middleware) {
	m.mws = append(m.mws, mw)
}

// Use registers the provided Handler as a middleware.
// The argument may be any supported handler or the Middleware type
// Deprecated: use UseMiddleware instead
func (m *Macaron) Use(h Handler) {
	m.mws = append(m.mws, mwFromHandler(h))
}

func mwFromHandler(handler Handler) Middleware {
	if mw, ok := handler.(Middleware); ok {
		return mw
	}

	h := wrapHandler(handler)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mrw, ok := w.(*responseWriter)
			if !ok {
				mrw = NewResponseWriter(r.Method, w).(*responseWriter)
			}

			h.ServeHTTP(mrw, r)
			if mrw.Written() {
				return
			}

			ctx := r.Context().Value(macaronContextKey{}).(*Context)
			next.ServeHTTP(ctx.Resp, ctx.Req)
		})
	}
}

// a convenience function that is provided for users of contexthandler package (standalone apiservers)
// who have an implicit dependency on Macron in context but don't want to take a dependency on
// router additionally
func EmptyMacaronMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		m := New()
		c := m.createContext(writer, request)
		next.ServeHTTP(writer, c.Req) // since c.Req has the newer context attached
	})
}

func (m *Macaron) createContext(rw http.ResponseWriter, req *http.Request) *Context {
	// NOTE: we have to explicitly copy the middleware chain here to avoid
	// passing a shared slice to the *Context, which leads to racy behavior in
	// case of later appends
	mws := make([]Middleware, len(m.mws))
	copy(mws, m.mws)

	c := &Context{
		mws:  mws,
		Resp: NewResponseWriter(req.Method, rw),
	}

	c.Req = req.WithContext(context.WithValue(req.Context(), macaronContextKey{}, c))
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
