package provisioning

import (
	"context"
	"net/http"
	"time"
)

// withTimeout adds a timeout context to the request
func withTimeout(h http.Handler, timeout time.Duration) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		h.ServeHTTP(w, r.WithContext(ctx))
	})
}

// withTimeoutFunc adds a timeout context to the request
func withTimeoutFunc(f func(w http.ResponseWriter, r *http.Request), timeout time.Duration) func(w http.ResponseWriter, r *http.Request) {
	return withTimeout(http.HandlerFunc(f), timeout).ServeHTTP
}
