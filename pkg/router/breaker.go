package router

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/sony/gobreaker/v2"
)

// statusRecorder is a thin passthrough http.ResponseWriter that remembers the
// status code written, without buffering the body -- unlike captureWriter
// (openapi_cache.go), which buffers the whole response and is only
// appropriate for small cached documents. CRUD+List responses proxied
// through the main dispatch can be large; the circuit breaker only needs the
// status code, so Write/Header pass straight through to preserve streaming.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func newStatusRecorder(w http.ResponseWriter) *statusRecorder {
	return &statusRecorder{ResponseWriter: w, status: http.StatusOK}
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// isBackendFailure reports whether a response status counts as a passive
// circuit-breaker failure: transport-level errors (surfaced by
// httputil.ReverseProxy's default ErrorHandler as 502) and the backend's own
// unavailability responses. Plain 500 is deliberately excluded -- that is
// usually an application bug or validation error, not evidence the backend
// is unreachable, and tripping the breaker on it would fail-fast unrelated
// future requests for no good reason. See AGENTS.md "Passive circuit
// breaking".
func isBackendFailure(status int) bool {
	return status == http.StatusBadGateway || status == http.StatusServiceUnavailable || status == http.StatusGatewayTimeout
}

// newGroupBreaker returns a fresh passive circuit breaker for one group,
// using gobreaker's own defaults (trip after more than 5 consecutive
// failures, 60s open cooldown, 1 half-open trial request) rather than
// inventing thresholds -- see AGENTS.md "Passive circuit breaking".
func newGroupBreaker(group string) *gobreaker.CircuitBreaker[struct{}] {
	return gobreaker.NewCircuitBreaker[struct{}](gobreaker.Settings{Name: group})
}

// serveThroughBreaker proxies one request to h through cb: closed/half-open
// calls h and streams the response straight to w via statusRecorder (no
// buffering, so streaming is preserved); open (or half-open already at its
// trial cap) skips h entirely and fails fast with a local 503 -- no dial
// attempted.
func serveThroughBreaker(cb *gobreaker.CircuitBreaker[struct{}], h http.Handler, w http.ResponseWriter, req *http.Request) {
	_, err := cb.Execute(func() (struct{}, error) {
		rec := newStatusRecorder(w)
		h.ServeHTTP(rec, req)
		if isBackendFailure(rec.status) {
			return struct{}{}, fmt.Errorf("router: backend returned status %d", rec.status)
		}
		return struct{}{}, nil
	})
	if errors.Is(err, gobreaker.ErrOpenState) || errors.Is(err, gobreaker.ErrTooManyRequests) {
		http.Error(w, "backend unavailable", http.StatusServiceUnavailable)
	}
}
