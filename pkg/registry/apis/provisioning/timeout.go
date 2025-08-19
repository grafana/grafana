package provisioning

import (
	"context"
	"net/http"
	"time"
)

// WithTimeout adds a timeout context to the request
func WithTimeout(h http.Handler, timeout time.Duration) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		h.ServeHTTP(w, r.WithContext(ctx))
	})
}

// WithTimeoutFunc adds a timeout context to the request
func WithTimeoutFunc(f func(w http.ResponseWriter, r *http.Request), timeout time.Duration) func(w http.ResponseWriter, r *http.Request) {
	return WithTimeout(http.HandlerFunc(f), timeout).ServeHTTP
}
