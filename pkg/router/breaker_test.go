package router

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sony/gobreaker/v2"
)

func TestIsBackendFailure(t *testing.T) {
	cases := []struct {
		status int
		want   bool
	}{
		{http.StatusOK, false},
		{http.StatusNotFound, false},
		{http.StatusInternalServerError, false}, // app bug, not backend unavailability
		{http.StatusBadGateway, true},
		{http.StatusServiceUnavailable, true},
		{http.StatusGatewayTimeout, true},
	}
	for _, tc := range cases {
		if got := isBackendFailure(tc.status); got != tc.want {
			t.Errorf("isBackendFailure(%d) = %v, want %v", tc.status, got, tc.want)
		}
	}
}

// TestStatusRecorderPassesThroughWithoutBuffering pins that statusRecorder
// only remembers the status code and otherwise behaves as a transparent
// passthrough -- unlike captureWriter, it must not buffer the body, since
// CRUD+List responses can be large and buffering would defeat streaming.
func TestStatusRecorderPassesThroughWithoutBuffering(t *testing.T) {
	rw := httptest.NewRecorder()
	rec := newStatusRecorder(rw)

	rec.WriteHeader(http.StatusTeapot)
	_, _ = rec.Write([]byte("hello"))

	if rec.status != http.StatusTeapot {
		t.Errorf("rec.status = %d, want %d", rec.status, http.StatusTeapot)
	}
	if rw.Code != http.StatusTeapot {
		t.Errorf("underlying writer code = %d, want %d (status must pass through immediately)", rw.Code, http.StatusTeapot)
	}
	if rw.Body.String() != "hello" {
		t.Errorf("underlying writer body = %q, want %q (body must pass through, not be buffered)", rw.Body.String(), "hello")
	}
}

// TestStatusRecorderDefaultsToOKWithoutExplicitWriteHeader mirrors
// http.ResponseWriter semantics: a handler that only calls Write (never
// WriteHeader) implicitly sends 200.
func TestStatusRecorderDefaultsToOKWithoutExplicitWriteHeader(t *testing.T) {
	rw := httptest.NewRecorder()
	rec := newStatusRecorder(rw)
	_, _ = rec.Write([]byte("hi"))
	if rec.status != http.StatusOK {
		t.Errorf("rec.status = %d, want %d", rec.status, http.StatusOK)
	}
}

// withGroupHandler builds a router serving one group whose handler is h,
// with a fresh circuit breaker -- for tests exercising breaker behavior
// through HandleFunc, where withGroups' fixed "write group name" handler
// isn't useful.
func withGroupHandler(group string, h http.Handler) *GrafanaRouter {
	s := NewGrafanaRouter(stubLoader{})
	s.served[group] = &handlerEntry{
		handler: h,
		lastRV:  "1",
		breaker: newGroupBreaker(group),
	}
	s.publish()
	return s
}

func fixedStatusHandler(status int) (http.Handler, *atomic.Int32) {
	var calls atomic.Int32
	h := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		w.WriteHeader(status)
	})
	return h, &calls
}

func TestHandleFuncClosedBreakerPassesThrough(t *testing.T) {
	h, calls := fixedStatusHandler(http.StatusOK)
	s := withGroupHandler("dashboard.grafana.app", h)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })

	rec := httptest.NewRecorder()
	s.HandleFunc(rec, httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/dashboards", nil), next)

	if rec.Code != http.StatusOK {
		t.Errorf("got code %d, want 200", rec.Code)
	}
	if calls.Load() != 1 {
		t.Errorf("handler called %d times, want 1", calls.Load())
	}
}

// TestHandleFuncBreakerTripsOpenAfterConsecutiveFailures pins the whole
// passive-breaker fail-fast contract: gobreaker's default ReadyToTrip opens
// after more than 5 consecutive failures (i.e. on the 6th), so the 6th 502 is
// still dialed, and only the 7th request onward is a local 503 with the
// backend never touched.
func TestHandleFuncBreakerTripsOpenAfterConsecutiveFailures(t *testing.T) {
	h, calls := fixedStatusHandler(http.StatusBadGateway)
	s := withGroupHandler("dashboard.grafana.app", h)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })

	for i := 1; i <= 6; i++ {
		rec := httptest.NewRecorder()
		s.HandleFunc(rec, httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/dashboards", nil), next)
		if rec.Code != http.StatusBadGateway {
			t.Fatalf("request %d: got code %d, want 502 (still dialed while closed)", i, rec.Code)
		}
	}
	if got := calls.Load(); got != 6 {
		t.Fatalf("handler called %d times after 6 failures, want 6", got)
	}

	rec := httptest.NewRecorder()
	s.HandleFunc(rec, httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/dashboards", nil), next)
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("7th request: got code %d, want 503 (breaker open, fail fast)", rec.Code)
	}
	if got := calls.Load(); got != 6 {
		t.Errorf("handler called %d times after breaker opened, want still 6 (no dial while open)", got)
	}
}

// TestHandleFuncBreakerIgnoresPlain500 pins that a plain 500 (app-level bug,
// not backend unavailability) never counts as a breaker failure -- see
// AGENTS.md "Passive circuit breaking".
func TestHandleFuncBreakerIgnoresPlain500(t *testing.T) {
	h, calls := fixedStatusHandler(http.StatusInternalServerError)
	s := withGroupHandler("dashboard.grafana.app", h)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })

	for i := 1; i <= 20; i++ {
		rec := httptest.NewRecorder()
		s.HandleFunc(rec, httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/dashboards", nil), next)
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("request %d: got code %d, want 500 (breaker must never open on plain 500s)", i, rec.Code)
		}
	}
	if got := calls.Load(); got != 20 {
		t.Errorf("handler called %d times, want 20 (breaker never opened, always dialed)", got)
	}
}

func withGroupHandlerAndBreaker(group string, h http.Handler, cb *gobreaker.CircuitBreaker[struct{}]) *GrafanaRouter {
	s := NewGrafanaRouter(stubLoader{})
	s.served[group] = &handlerEntry{handler: h, lastRV: "1", breaker: cb}
	s.publish()
	return s
}

// TestHandleFuncBreakerHalfOpenRecovers pins the full open -> half-open ->
// closed recovery path: after Timeout elapses, one trial request is dialed;
// success closes the breaker again.
func TestHandleFuncBreakerHalfOpenRecovers(t *testing.T) {
	const timeout = 20 * time.Millisecond
	var succeed atomic.Bool
	h := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if succeed.Load() {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusBadGateway)
		}
	})

	cb := gobreaker.NewCircuitBreaker[struct{}](gobreaker.Settings{
		Name:        "test",
		ReadyToTrip: func(c gobreaker.Counts) bool { return c.ConsecutiveFailures >= 1 },
		Timeout:     timeout,
	})
	s := withGroupHandlerAndBreaker("dashboard.grafana.app", h, cb)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	req := func() *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		s.HandleFunc(rec, httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/x", nil), next)
		return rec
	}

	// Trip open.
	if rec := req(); rec.Code != http.StatusBadGateway {
		t.Fatalf("tripping request: got %d, want 502", rec.Code)
	}
	if cb.State() != gobreaker.StateOpen {
		t.Fatalf("breaker state = %v, want open", cb.State())
	}

	// While still open, fail fast.
	if rec := req(); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("while open: got %d, want 503", rec.Code)
	}

	time.Sleep(timeout * 2)
	succeed.Store(true)

	// Trial request after timeout: dialed, succeeds, closes the breaker.
	if rec := req(); rec.Code != http.StatusOK {
		t.Fatalf("half-open trial: got %d, want 200", rec.Code)
	}
	if cb.State() != gobreaker.StateClosed {
		t.Fatalf("breaker state after successful trial = %v, want closed", cb.State())
	}
}

// TestHandleFuncBreakerHalfOpenCapRejectsConcurrentTrial pins that only
// gobreaker's MaxRequests (default 1) trial request is let through in
// half-open; a concurrent request arriving during that trial gets
// ErrTooManyRequests, mapped to the same local 503, without a second dial.
func TestHandleFuncBreakerHalfOpenCapRejectsConcurrentTrial(t *testing.T) {
	const timeout = 20 * time.Millisecond
	entered := make(chan struct{})
	release := make(chan struct{})
	var dials atomic.Int32
	first := true
	var mu sync.Mutex
	h := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		dials.Add(1)
		mu.Lock()
		isFirst := first
		first = false
		mu.Unlock()
		if isFirst {
			w.WriteHeader(http.StatusBadGateway) // trips the breaker
			return
		}
		close(entered) // this is the half-open trial call
		<-release
		w.WriteHeader(http.StatusOK)
	})

	cb := gobreaker.NewCircuitBreaker[struct{}](gobreaker.Settings{
		Name:        "test",
		ReadyToTrip: func(c gobreaker.Counts) bool { return c.ConsecutiveFailures >= 1 },
		Timeout:     timeout,
	})
	s := withGroupHandlerAndBreaker("dashboard.grafana.app", h, cb)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	doReq := func() *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		s.HandleFunc(rec, httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/x", nil), next)
		return rec
	}

	if rec := doReq(); rec.Code != http.StatusBadGateway {
		t.Fatalf("tripping request: got %d, want 502", rec.Code)
	}
	time.Sleep(timeout * 2)

	trialDone := make(chan int, 1)
	go func() {
		trialDone <- doReq().Code
	}()
	<-entered // trial request is now inside the handler, blocked

	rejected := doReq()
	if rejected.Code != http.StatusServiceUnavailable {
		t.Errorf("concurrent request during half-open trial: got %d, want 503", rejected.Code)
	}
	if got := dials.Load(); got != 2 { // 1 tripping call + 1 trial call; the concurrent one must not dial
		t.Errorf("dials = %d, want 2 (concurrent request must not reach the handler)", got)
	}

	close(release)
	if code := <-trialDone; code != http.StatusOK {
		t.Errorf("trial request: got %d, want 200", code)
	}
}

type staticLoader struct{ backends []Backend }

func (l staticLoader) Load(context.Context) ([]Backend, error) { return l.backends, nil }
func (l staticLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

// tripBreaker forces cb into the open state by feeding it one failure through
// a ReadyToTrip that opens on the first one, independent of production
// thresholds -- these lifecycle tests care about whether trip *state*
// survives reconcile, not how many failures it takes to get there.
func tripBreaker(cb *gobreaker.CircuitBreaker[struct{}]) {
	_, _ = cb.Execute(func() (struct{}, error) { return struct{}{}, errors.New("forced failure") })
}

// TestReconcileUnchangedRVPreservesBreakerState pins that a group whose RV
// hasn't changed is left completely untouched by reconcile -- including an
// already-tripped breaker -- same as the existing backend/handler/pool
// preservation.
func TestReconcileUnchangedRVPreservesBreakerState(t *testing.T) {
	group := "dashboard.grafana.app"
	cb := gobreaker.NewCircuitBreaker[struct{}](gobreaker.Settings{
		Name:        group,
		ReadyToTrip: func(c gobreaker.Counts) bool { return c.ConsecutiveFailures >= 1 },
	})
	tripBreaker(cb)
	if cb.State() != gobreaker.StateOpen {
		t.Fatalf("precondition: breaker state = %v, want open", cb.State())
	}

	r := NewGrafanaRouter(staticLoader{backends: []Backend{
		&fakeBackend{group: group, rv: "5"},
	}})
	r.served[group] = &handlerEntry{handler: http.NotFoundHandler(), lastRV: "5", breaker: cb}

	if err := r.reconcile(context.Background()); err != nil {
		t.Fatalf("reconcile: %v", err)
	}

	got := r.served[group]
	if got.breaker != cb {
		t.Errorf("breaker instance replaced on unchanged-RV reconcile; want the same pointer preserved")
	}
	if got.breaker.State() != gobreaker.StateOpen {
		t.Errorf("breaker state = %v after unchanged-RV reconcile, want still open", got.breaker.State())
	}
}

// TestReconcileChangedRVResetsBreaker pins the opposite: an RV change rebuilds
// the group, and the breaker is reset to a fresh, closed instance -- even if
// the old one was open -- because the target may have moved.
func TestReconcileChangedRVResetsBreaker(t *testing.T) {
	group := "dashboard.grafana.app"
	oldCB := gobreaker.NewCircuitBreaker[struct{}](gobreaker.Settings{
		Name:        group,
		ReadyToTrip: func(c gobreaker.Counts) bool { return c.ConsecutiveFailures >= 1 },
	})
	tripBreaker(oldCB)
	if oldCB.State() != gobreaker.StateOpen {
		t.Fatalf("precondition: breaker state = %v, want open", oldCB.State())
	}

	r := NewGrafanaRouter(staticLoader{backends: []Backend{
		&fakeBackend{group: group, rv: "6"}, // changed from "5"
	}})
	r.served[group] = &handlerEntry{handler: http.NotFoundHandler(), lastRV: "5", breaker: oldCB}

	if err := r.reconcile(context.Background()); err != nil {
		t.Fatalf("reconcile: %v", err)
	}

	got := r.served[group]
	if got.breaker == oldCB {
		t.Fatalf("breaker instance not replaced on changed-RV reconcile")
	}
	if got.breaker.State() != gobreaker.StateClosed {
		t.Errorf("breaker state = %v after changed-RV rebuild, want closed (fresh instance)", got.breaker.State())
	}
}

// TestOpenAPIGroupVersionRoutesThroughBreaker pins that the per-group-version
// OpenAPI cache-miss proxy path is gated by the same per-group breaker as the
// main dispatch: repeated backend failures trip it, and once open the
// backend is no longer dialed at all.
func TestOpenAPIGroupVersionRoutesThroughBreaker(t *testing.T) {
	upstream, calls := fixedStatusHandler(http.StatusBadGateway)
	s := buildRouterWithBackend("dashboard.grafana.app", "5", upstream)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	path := "/openapi/v3/apis/dashboard.grafana.app/v1alpha1"

	for i := 1; i <= 6; i++ {
		rec := httptest.NewRecorder()
		s.HandleFunc(rec, httptest.NewRequest(http.MethodGet, path, nil), next)
		if rec.Code != http.StatusBadGateway {
			t.Fatalf("request %d: got code %d, want 502 (still dialed while closed)", i, rec.Code)
		}
	}
	if got := calls.Load(); got != 6 {
		t.Fatalf("upstream hits = %d, want 6", got)
	}

	rec := httptest.NewRecorder()
	s.HandleFunc(rec, httptest.NewRequest(http.MethodGet, path, nil), next)
	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("7th request: got code %d, want 503 (breaker open, fail fast)", rec.Code)
	}
	if got := calls.Load(); got != 6 {
		t.Errorf("upstream hits = %d after breaker opened, want still 6 (no dial while open)", got)
	}
}

// TestOpenAPIGroupVersionCacheHitBypassesBreaker pins that a cache hit never
// touches the breaker at all -- it never calls the backend, so there's
// nothing to protect. Even with the breaker forced open, a cached doc at the
// matching RV must still be served successfully from cache.
func TestOpenAPIGroupVersionCacheHitBypassesBreaker(t *testing.T) {
	group := "dashboard.grafana.app"
	upstream := &countingHandler{body: `{"openapi":"3.0.0"}`}
	cb := gobreaker.NewCircuitBreaker[struct{}](gobreaker.Settings{
		Name:        group,
		ReadyToTrip: func(c gobreaker.Counts) bool { return c.ConsecutiveFailures >= 1 },
	})
	s := withGroupHandlerAndBreaker(group, upstream, cb)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	path := "/openapi/v3/apis/dashboard.grafana.app/v1alpha1"

	// First request: cache miss, proxies through, populates the cache.
	rec1 := httptest.NewRecorder()
	s.HandleFunc(rec1, httptest.NewRequest(http.MethodGet, path, nil), next)
	if rec1.Code != http.StatusOK {
		t.Fatalf("first request: got code %d, want 200", rec1.Code)
	}

	// Force the breaker open, simulating an outage discovered via other
	// traffic to this group.
	tripBreaker(cb)
	if cb.State() != gobreaker.StateOpen {
		t.Fatalf("precondition: breaker state = %v, want open", cb.State())
	}

	// Second request, same RV: must still be served from cache, untouched by
	// the open breaker.
	rec2 := httptest.NewRecorder()
	s.HandleFunc(rec2, httptest.NewRequest(http.MethodGet, path, nil), next)
	if rec2.Code != http.StatusOK {
		t.Errorf("cache-hit request with breaker open: got code %d, want 200 (cache hit must bypass the breaker)", rec2.Code)
	}
	if got := upstream.hits.Load(); got != 1 {
		t.Errorf("upstream hits = %d, want 1 (second request must be served from cache, not dialed)", got)
	}
}

// TestStatusRecorderUnwrapsForFlush pins that statusRecorder exposes Unwrap
// so http.ResponseController can reach the underlying ResponseWriter's real
// Flush -- without it, httputil.ReverseProxy's periodic/immediate flush for
// streamed responses (chunked, SSE, any response with no Content-Length)
// silently degrades because the wrapper hides the real Flusher.
func TestStatusRecorderUnwrapsForFlush(t *testing.T) {
	rw := httptest.NewRecorder()
	rec := newStatusRecorder(rw)
	if err := http.NewResponseController(rec).Flush(); err != nil {
		t.Fatalf("Flush() via ResponseController = %v, want nil (statusRecorder must unwrap to the underlying Flusher)", err)
	}
	if !rw.Flushed {
		t.Errorf("underlying recorder Flushed = false, want true")
	}
}

// TestCaptureWriterSupportsFlush pins that captureWriter exposes a Flush so
// ReverseProxy's flush machinery doesn't treat it as unsupported. Unlike
// statusRecorder, captureWriter owns its own in-memory buffer (nothing real
// to unwrap to yet -- the buffered body is copied to the real
// ResponseWriter only after ServeHTTP returns), so a no-op Flush is correct
// here, not Unwrap.
func TestCaptureWriterSupportsFlush(t *testing.T) {
	rec := newCaptureWriter()
	if err := http.NewResponseController(rec).Flush(); err != nil {
		t.Errorf("Flush() via ResponseController = %v, want nil (captureWriter must expose a no-op Flush)", err)
	}
}

// TestHandleFuncBreakerIgnoresCanceledRequests pins that a canceled request
// context (client disconnect) is excluded from breaker accounting entirely --
// ReverseProxy maps a canceled request to its default 502, and without this
// exclusion a handful of abandoned client requests would trip the breaker and
// fail-fast every other caller for the cooldown window, even though the
// backend itself is healthy.
func TestHandleFuncBreakerIgnoresCanceledRequests(t *testing.T) {
	h, calls := fixedStatusHandler(http.StatusBadGateway) // simulates ReverseProxy's cancel->502 mapping
	s := withGroupHandler("dashboard.grafana.app", h)     // real newGroupBreaker defaults
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // pre-canceled: simulates a client that already disconnected

	for i := 1; i <= 20; i++ {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/x", nil).WithContext(ctx)
		s.HandleFunc(rec, req, next)
	}
	if got := calls.Load(); got != 20 {
		t.Fatalf("handler called %d times, want 20 (breaker must never open on canceled-context requests)", got)
	}
}
