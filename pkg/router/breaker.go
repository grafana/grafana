package router

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/sony/gobreaker/v2"
	"go.opentelemetry.io/otel/trace"
)

// statusRecorder is a passthrough http.ResponseWriter that records the status
// code without buffering the body, so proxied responses still stream.
type statusRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool

	// Set by serveThroughBreaker: the breaker's done, called once with the
	// call's outcome as soon as the final status is written, and what that
	// outcome is read from.
	breakerDone func(error)
	breakerReq  *http.Request
	breakerCall *backendCall
	reportOnce  sync.Once

	// span and spanCtx are the router span traceRouterRequest started, which
	// endSpan ends.
	span    trace.Span
	spanCtx context.Context
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
		if r.breakerDone != nil {
			r.reportBreaker(breakerOutcome(r.breakerReq, code, r.breakerCall))
		}
	}
	r.ResponseWriter.WriteHeader(code)
}

// reportBreaker gives the breaker the call's outcome, once.
func (r *statusRecorder) reportBreaker(outcome error) {
	r.reportOnce.Do(func() { r.breakerDone(outcome) })
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
	// A watch flushes after every event, so skip building a controller when
	// the writer flushes itself.
	switch w := r.ResponseWriter.(type) {
	case interface{ FlushError() error }:
		return w.FlushError()
	case http.Flusher:
		w.Flush()
		return nil
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

// groupBreaker is two-step, so an outcome can be reported when the response
// status is known rather than when the handler returns.
type groupBreaker = gobreaker.TwoStepCircuitBreaker[struct{}]

// errCallerGone marks a request whose own context ended: the caller left or
// its deadline passed. That says nothing about the backend's health.
var errCallerGone = errors.New("router: caller's request ended")

// errRouterDeadline is the cause of a deadline the router sets on its own
// fetches, such as discovery. Unlike the caller leaving, missing it says the
// backend was too slow, so it counts against the backend's breaker.
var errRouterDeadline = errors.New("router: fetch deadline exceeded")

// callerGone returns errCallerGone when ctx ended because its caller left or
// the caller's own deadline passed, and nil otherwise, including when only a
// deadline the router set has passed.
func callerGone(ctx context.Context) error {
	err := ctx.Err()
	if err == nil || errors.Is(context.Cause(ctx), errRouterDeadline) {
		return nil
	}
	return fmt.Errorf("%w: %w", errCallerGone, err)
}

// newGroupBreaker returns a circuit breaker with gobreaker's defaults (trips
// after more than 5 consecutive failures, stays open 60s). Only errCallerGone
// is excluded. Matching context errors instead would also exclude backend
// timeouts, such as the transport's response-header timeout, which matches
// context.DeadlineExceeded.
func newGroupBreaker(group string) *groupBreaker {
	return newObservedGroupBreaker(group, nil)
}

// newObservedGroupBreaker is newGroupBreaker, calling onChange with the group
// and its new state on every transition.
// A group's breaker opens after breakerOpenAfter consecutive failures and
// lets a trial request through after breakerOpenFor. These are gobreaker's
// defaults, set explicitly so the status page reports what is in force.
const (
	breakerOpenAfter = 6
	breakerOpenFor   = 60 * time.Second
)

// breakerView records a group breaker's state as the breaker reports its
// changes, so the status page and the metrics can read it without changing it.
// gobreaker's State is not a pure read: once an open breaker's timeout has
// passed, it moves the breaker to half-open, clears its counts and fires the
// change callback, which only a request should do.
type breakerView struct {
	state    atomic.Int32 // a gobreaker.State; the zero value is closed
	openedAt atomic.Int64 // Unix nanoseconds when the breaker last opened
}

func (v *breakerView) record(to gobreaker.State) {
	if to == gobreaker.StateOpen {
		v.openedAt.Store(time.Now().UnixNano())
	}
	v.state.Store(int32(to))
}

func (v *breakerView) State() gobreaker.State { return gobreaker.State(v.state.Load()) }

// RetryAt is when an open breaker lets its next request through as a trial.
// Its state stays open until that request arrives.
func (v *breakerView) RetryAt() (time.Time, bool) {
	if v.State() != gobreaker.StateOpen {
		return time.Time{}, false
	}
	return time.Unix(0, v.openedAt.Load()).Add(breakerOpenFor).UTC(), true
}

func newObservedGroupBreaker(group string, onChange func(group string, to gobreaker.State)) *groupBreaker {
	settings := gobreaker.Settings{
		Name:    group,
		Timeout: breakerOpenFor,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= breakerOpenAfter
		},
		IsExcluded: func(err error) bool {
			return errors.Is(err, errCallerGone)
		},
	}
	if onChange != nil {
		settings.OnStateChange = func(name string, _, to gobreaker.State) { onChange(name, to) }
	}
	return gobreaker.NewTwoStepCircuitBreaker[struct{}](settings)
}

// breakerOutcome turns one proxy attempt into the error reported to the
// breaker: errCallerGone if the request's own context
// ended (checked first, so a disconnect is never counted against the
// backend), the recorded proxy failure, a backend-failure error for
// isBackendFailure statuses, or nil.
func breakerOutcome(req *http.Request, status int, call *backendCall) error {
	if err := callerGone(req.Context()); err != nil {
		return err
	}
	if call.proxyErr != nil {
		if errors.Is(call.proxyErr, errBackendRedirect) {
			return nil // the backend answered; the router refused to relay it
		}
		return fmt.Errorf("router: proxy failed: %w", call.proxyErr)
	}
	if isBackendFailure(status) {
		return fmt.Errorf("router: backend returned status %d", status)
	}
	return nil
}

// requestRouter is a handler that hands each request to another handler.
type requestRouter interface {
	handlerFor(*http.Request) http.Handler
	// groupHandler is the handler of the backend that owns the group, whose
	// breaker the group reports.
	groupHandler() http.Handler
}

// breakerScope is what a group's breaker counts. publish records it once
// per entry, for metrics and the status page.
type breakerScope int

const (
	// breakerScopeRequests counts the proxied requests.
	breakerScopeRequests breakerScope = iota
	// breakerScopePluginCalls counts only the plugin's client calls
	// (breaksOnClientCalls).
	breakerScopePluginCalls
	// breakerScopePerDestination counts nothing here: the handler keeps a
	// breaker per destination itself (managesCircuitBreaking).
	breakerScopePerDestination
	// breakerScopeNone means the group has no breaker (hasNoCircuitBreaker).
	breakerScopeNone
)

func (s breakerScope) String() string {
	switch s {
	case breakerScopePluginCalls:
		return "plugin-calls"
	case breakerScopePerDestination:
		return "per-destination"
	case breakerScopeNone:
		return "none"
	default:
		return "requests"
	}
}

// counted reports whether the group breaker counts anything.
func (s breakerScope) counted() bool {
	return s == breakerScopeRequests || s == breakerScopePluginCalls
}

// groupBreakerScope returns the scope of the group breaker in front of h. A
// requestRouter reports the scope of the handler that owns the group.
func groupBreakerScope(h http.Handler) breakerScope {
	if router, ok := h.(requestRouter); ok {
		h = router.groupHandler()
	}
	switch h.(type) {
	case interface{ managesCircuitBreaking() }:
		return breakerScopePerDestination
	case interface{ hasNoCircuitBreaker() }:
		return breakerScopeNone
	case interface{ breaksOnClientCalls() }:
		return breakerScopePluginCalls
	}
	return breakerScopeRequests
}

// withoutGroupBreaker reports whether h is served without the group breaker:
// it keeps a breaker per destination itself (managesCircuitBreaking, the
// single-tenant fallback), which must not also share a group-wide one, or it
// has none (hasNoCircuitBreaker, the embedded API server, in process).
func withoutGroupBreaker(h http.Handler) bool {
	switch h.(type) {
	case interface{ managesCircuitBreaking() }, interface{ hasNoCircuitBreaker() }:
		return true
	}
	return false
}

// serveThroughBreaker proxies one request to h through cb, streaming the
// response straight to w. An open breaker (or a half-open one already running
// its trial request) fails fast with a local 503, unless h gates its own client
// calls through the breaker passed in the request context.
//
// The outcome is reported as soon as the response status is written, not when
// the body ends. A watch streams for as long as it lasts; holding its outcome
// until then would keep a half-open breaker's only trial slot for that long.
func serveThroughBreaker(cb *groupBreaker, group string, h http.Handler, w http.ResponseWriter, req *http.Request) {
	// A handler that sends some of a group's requests elsewhere picks the
	// handler first, so only that handler's breakers see the request.
	if router, ok := h.(requestRouter); ok {
		h = router.handlerFor(req)
	}
	if withoutGroupBreaker(h) {
		h.ServeHTTP(w, req)
		return
	}
	rec, req, call := traceRouterRequest(w, req, "router.backend", group)
	defer rec.endSpan()
	w = rec.writer()
	// Client-scoped breakers leave requests that do not call the client available.
	if _, clientScoped := h.(interface{ breaksOnClientCalls() }); clientScoped {
		call.breaker = cb
		h.ServeHTTP(w, req)
		return
	}
	done, err := cb.Allow()
	if err != nil {
		setFailure(req, failureBreakerOpen)
		http.Error(w, "backend unavailable", http.StatusServiceUnavailable)
		return
	}
	rec.breakerDone, rec.breakerReq, rec.breakerCall = done, req, call
	defer func() {
		if p := recover(); p != nil {
			outcome := breakerOutcome(req, rec.status, call)
			if outcome == nil {
				outcome = fmt.Errorf("router: backend handler panicked: %v", p)
			}
			rec.reportBreaker(outcome)
			panic(p)
		}
		rec.reportBreaker(breakerOutcome(req, rec.status, call))
		if call.proxyErr != nil {
			if reason := failureReason(req, call.proxyErr); reason != "" {
				setFailure(req, reason)
			}
		}
	}()
	h.ServeHTTP(w, req)
}
