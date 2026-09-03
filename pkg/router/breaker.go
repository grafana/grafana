package router

import (
	"context"
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

// Unwrap exposes the real ResponseWriter to http.ResponseController, so
// ReverseProxy's Flush (used for chunked/SSE/any response with no
// Content-Length) reaches the real connection instead of silently
// no-opping against this wrapper. Per net/http's documented pattern for
// wrapping ResponseWriter without hiding optional interfaces (Flusher,
// Hijacker, etc).
func (r *statusRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
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
// inventing thresholds -- see AGENTS.md "Passive circuit breaking". Context
// cancellation/deadline errors are excluded from success/failure accounting
// entirely (gobreaker calls this "excluded", not counted either way): a
// client disconnecting mid-request surfaces through ReverseProxy as a 502
// like any other transport failure, but it says nothing about the backend's
// health, and a handful of abandoned requests must not trip the breaker for
// every other caller.
func newGroupBreaker(group string) *gobreaker.CircuitBreaker[struct{}] {
	return gobreaker.NewCircuitBreaker[struct{}](gobreaker.Settings{
		Name: group,
		IsExcluded: func(err error) bool {
			return errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)
		},
	})
}

// breakerOutcome turns one completed proxy attempt into the error
// cb.Execute's func should return: the request's context error if it was
// canceled/timed out (excluded by newGroupBreaker's IsExcluded, checked
// ahead of status so a disconnect is never miscounted as a backend
// failure), a backend-failure error for isBackendFailure statuses, or nil.
func breakerOutcome(req *http.Request, status int) error {
	if err := req.Context().Err(); err != nil {
		return err
	}
	if isBackendFailure(status) {
		return fmt.Errorf("router: backend returned status %d", status)
	}
	return nil
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
		return struct{}{}, breakerOutcome(req, rec.status)
	})
	if errors.Is(err, gobreaker.ErrOpenState) || errors.Is(err, gobreaker.ErrTooManyRequests) {
		http.Error(w, "backend unavailable", http.StatusServiceUnavailable)
	}
}
