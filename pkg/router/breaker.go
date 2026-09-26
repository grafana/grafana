package router

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/sony/gobreaker/v2"
)

// statusRecorder is a passthrough http.ResponseWriter that records the status
// code without buffering the body, so proxied responses still stream.
type statusRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func newStatusRecorder(w http.ResponseWriter) *statusRecorder {
	return &statusRecorder{ResponseWriter: w, status: http.StatusOK}
}

func (r *statusRecorder) WriteHeader(code int) {
	if r.wroteHeader {
		return
	}
	if code >= 200 || code == http.StatusSwitchingProtocols {
		r.status = code
		r.wroteHeader = true
	}
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(body []byte) (int, error) {
	if !r.wroteHeader {
		r.WriteHeader(http.StatusOK)
	}
	return r.ResponseWriter.Write(body)
}

func (r *statusRecorder) FlushError() error {
	if !r.wroteHeader {
		r.WriteHeader(http.StatusOK)
	}
	return http.NewResponseController(r.ResponseWriter).Flush()
}

// Unwrap lets http.ResponseController reach the real writer, so
// ReverseProxy's flushes are not silently dropped by this wrapper.
func (r *statusRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}

// writer returns r as an http.Flusher, adding CloseNotify and Hijack when the
// real writer has them, for passing to handlers. Unwrap is enough for
// ReverseProxy, but in-process plugin apiservers type-assert http.Flusher to
// start a watch, and their own wrappers (responsewriter.WrapForHTTP1Or2) only
// keep Flush when the writer they wrap has both Flush and CloseNotify.
func (r *statusRecorder) writer() http.ResponseWriter {
	f := recorderFlusher{r}
	cn, ok := r.ResponseWriter.(closeNotifier)
	if !ok {
		return f
	}
	n := recorderFlushNotifier{f, cn}
	if hj, ok := r.ResponseWriter.(http.Hijacker); ok {
		return recorderFlushNotifyHijacker{n, hj}
	}
	return n
}

// closeNotifier is http.CloseNotifier, which is deprecated but still required
// by the apiserver's writer wrappers.
type closeNotifier interface{ CloseNotify() <-chan bool }

// recorderFlusher flushes through FlushError, so a flush before WriteHeader
// still records the implicit 200.
type recorderFlusher struct{ *statusRecorder }

func (w recorderFlusher) Flush() { _ = w.FlushError() }

type recorderFlushNotifier struct {
	recorderFlusher
	closeNotifier
}

type recorderFlushNotifyHijacker struct {
	recorderFlushNotifier
	http.Hijacker
}

// isBackendFailure reports whether a status counts as a breaker failure:
// ReverseProxy's 502 for transport errors, plus 503 and 504. A plain 500 is
// usually an application error, not an unreachable backend, so it is excluded.
func isBackendFailure(status int) bool {
	return status == http.StatusBadGateway || status == http.StatusServiceUnavailable || status == http.StatusGatewayTimeout
}

// newGroupBreaker returns a circuit breaker with gobreaker's defaults (trips
// after more than 5 consecutive failures, stays open 60s). Context errors are
// excluded: a client disconnect surfaces as a 502 but says nothing about the
// backend's health.
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
func serveThroughBreaker(cb *gobreaker.CircuitBreaker[struct{}], group string, h http.Handler, w http.ResponseWriter, req *http.Request) {
	// A handler spanning multiple destinations must not also share a group-wide breaker.
	if _, ownsBreakers := h.(interface{ managesCircuitBreaking() }); ownsBreakers {
		h.ServeHTTP(w, req)
		return
	}
	rec, req, endSpan := traceRouterRequest(w, req, "router.backend", group)
	defer endSpan()
	w = rec.writer()
	_, err := cb.Execute(func() (struct{}, error) {
		h.ServeHTTP(w, req)
		return struct{}{}, breakerOutcome(req, rec.status)
	})
	if errors.Is(err, gobreaker.ErrOpenState) || errors.Is(err, gobreaker.ErrTooManyRequests) {
		http.Error(w, "backend unavailable", http.StatusServiceUnavailable)
	}
}
