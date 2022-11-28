package webtest

import (
	"net/http"
	"net/http/httptest"

	"github.com/grafana/grafana/pkg/web"
)

type Context struct {
	Req  *http.Request
	Rw   http.ResponseWriter
	Next http.Handler
}

// Middleware is a utility for testing middlewares
type Middleware struct {
	// Before are run ahead of the returned context
	Before []web.Handler
	// After are part of the http.Handler chain
	After []web.Handler
	// The actual handler at the end of the chain
	Handler web.Handler
}

// MiddlewareContext returns a *http.Request, http.ResponseWriter and http.Handler
// exactly as if it was passed to a middleware
func MiddlewareContext(test Middleware, req *http.Request) *Context {
	m := web.New()

	// pkg/web requires the chain to write an HTTP response.
	// While this ensures a basic amount of correctness for real handler chains,
	// it is naturally incompatible with this package, as we terminate the chain early to pass its
	// state to the surrounding test.
	// By replacing the http.ResponseWriter and writing to the old one we make pkg/web happy.
	m.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)

			rw := web.Rw(httptest.NewRecorder(), r)
			next.ServeHTTP(rw, r)
		})
	})

	for _, mw := range test.Before {
		m.Use(mw)
	}

	ch := make(chan *Context)
	m.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ch <- &Context{
				Req:  r,
				Rw:   w,
				Next: next,
			}
		})
	})

	for _, mw := range test.After {
		m.Use(mw)
	}

	// set the provided (or noop) handler to exactly the queried path
	handler := test.Handler
	if handler == nil {
		handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})
	}
	m.Handle(req.Method, req.URL.RequestURI(), []web.Handler{handler})
	go m.ServeHTTP(httptest.NewRecorder(), req)

	return <-ch
}
