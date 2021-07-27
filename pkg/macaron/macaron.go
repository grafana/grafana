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
package macaron // import "gopkg.in/macaron.v1"

import (
	"context"
	"log"
	"net/http"
	"os"
	"reflect"
	"strings"
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
// and panics if an argument could not be fullfilled via dependency injection.
type Handler interface{}

// handlerFuncInvoker is an inject.FastInvoker wrapper of func(http.ResponseWriter, *http.Request).
type handlerFuncInvoker func(http.ResponseWriter, *http.Request)

func (invoke handlerFuncInvoker) Invoke(params []interface{}) ([]reflect.Value, error) {
	invoke(params[0].(http.ResponseWriter), params[1].(*http.Request))
	return nil, nil
}

// internalServerErrorInvoker is an inject.FastInvoker wrapper of func(rw http.ResponseWriter, err error).
type internalServerErrorInvoker func(rw http.ResponseWriter, err error)

func (invoke internalServerErrorInvoker) Invoke(params []interface{}) ([]reflect.Value, error) {
	invoke(params[0].(http.ResponseWriter), params[1].(error))
	return nil, nil
}

// validateAndWrapHandler makes sure a handler is a callable function, it panics if not.
// When the handler is also potential to be any built-in inject.FastInvoker,
// it wraps the handler automatically to have some performance gain.
func validateAndWrapHandler(h Handler) Handler {
	if reflect.TypeOf(h).Kind() != reflect.Func {
		panic("Macaron handler must be a callable function")
	}

	if !IsFastInvoker(h) {
		switch v := h.(type) {
		case func(*Context):
			return ContextInvoker(v)
		case func(http.ResponseWriter, *http.Request):
			return handlerFuncInvoker(v)
		case func(http.ResponseWriter, error):
			return internalServerErrorInvoker(v)
		}
	}
	return h
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
	Injector
	befores  []BeforeHandler
	handlers []Handler

	hasURLPrefix bool
	urlPrefix    string // For suburl support.
	*Router

	logger *log.Logger
}

// New creates a bare bones Macaron instance.
// Use this method if you want to have full control over the middleware that is used.
func New() *Macaron {
	m := &Macaron{
		Injector: NewInjector(),
		Router:   NewRouter(),
		logger:   log.New(os.Stdout, "[Macaron] ", 0),
	}
	m.Router.m = m
	m.Map(m.logger)
	m.Map(defaultReturnHandler())
	m.NotFound(http.NotFound)
	m.InternalServerError(func(rw http.ResponseWriter, err error) {
		http.Error(rw, err.Error(), 500)
	})
	return m
}

// BeforeHandler represents a handler executes at beginning of every request.
// Macaron stops future process when it returns true.
type BeforeHandler func(rw http.ResponseWriter, req *http.Request) bool

// macaronContextKey is used to store/fetch macaron.Context inside context.Context
type macaronContextKey struct{}

// FromContext returns the macaron context stored in a context.Context, if any.
func FromContext(c context.Context) *Context {
	if mc, ok := c.Value(macaronContextKey{}).(*Context); ok {
		return mc
	}
	return nil
}

// UseMiddleware is a traditional approach to writing middleware in Go.
// A middleware is a function that has a reference to the next handler in the chain
// and returns the actual middleware handler, that may do its job and optionally
// call next.
// Due to how Macaron handles/injects requests and responses we patch the macaron.Context
// to use the new ResponseWriter and http.Request here. The caller may only call
// `next.ServeHTTP(rw, req)` to pass a modified response writer and/or a request to the
// further middlewares in the chain.
func (m *Macaron) UseMiddleware(middleware func(http.Handler) http.Handler) {
	next := http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		c := FromContext(req.Context())
		c.Req.Request = req
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
		Render:   &DummyRender{rw},
		Data:     make(map[string]interface{}),
	}
	req = req.WithContext(context.WithValue(req.Context(), macaronContextKey{}, c))
	c.SetParent(m)
	c.Map(c)
	c.MapTo(c.Resp, (*http.ResponseWriter)(nil))
	c.Map(req)
	c.Req = Request{req}
	return c
}

// ServeHTTP is the HTTP Entry point for a Macaron instance.
// Useful if you want to control your own HTTP server.
// Be aware that none of middleware will run without registering any router.
func (m *Macaron) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	if m.hasURLPrefix {
		req.URL.Path = strings.TrimPrefix(req.URL.Path, m.urlPrefix)
	}
	for _, h := range m.befores {
		if h(rw, req) {
			return
		}
	}
	m.Router.ServeHTTP(rw, req)
}

// SetURLPrefix sets URL prefix of router layer, so that it support suburl.
func (m *Macaron) SetURLPrefix(prefix string) {
	m.urlPrefix = prefix
	m.hasURLPrefix = len(m.urlPrefix) > 0
}
