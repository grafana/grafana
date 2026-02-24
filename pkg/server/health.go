package server

import (
	"net/http"
	"sync/atomic"

	"github.com/gorilla/mux"
)

// HealthNotifier is a thread-safe mechanism for operators to signal
// that they have completed initialization and are ready to serve.
type HealthNotifier struct {
	ready atomic.Bool
}

// NewHealthNotifier creates a new HealthNotifier in a not-ready state.
func NewHealthNotifier() *HealthNotifier {
	return &HealthNotifier{}
}

// SetReady marks the operator as ready. This is safe to call from any goroutine.
func (h *HealthNotifier) SetReady() {
	h.ready.Store(true)
}

// SetNotReady marks the operator as not ready. This is safe to call from any goroutine.
func (h *HealthNotifier) SetNotReady() {
	h.ready.Store(false)
}

// IsReady returns true if the operator has signaled readiness.
func (h *HealthNotifier) IsReady() bool {
	return h.ready.Load()
}

// LivezHandler returns an http.HandlerFunc that always responds 200 OK,
// indicating the process is alive and serving HTTP.
func LivezHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	}
}

// ReadyzHandler returns an http.HandlerFunc that responds 200 OK only
// when the HealthNotifier reports ready; otherwise 503 Service Unavailable.
func ReadyzHandler(h *HealthNotifier) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if h != nil && h.IsReady() {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("OK"))
			return
		}
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte("not ready"))
	}
}

// RegisterHealthEndpoints registers the /livez and /readyz probe endpoints
// on the given router.
func RegisterHealthEndpoints(router *mux.Router, h *HealthNotifier) {
	router.HandleFunc("/livez", LivezHandler()).Methods("GET")
	router.HandleFunc("/readyz", ReadyzHandler(h)).Methods("GET")
}
