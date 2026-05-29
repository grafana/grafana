package provisioning

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

// fakeConnecter implements rest.Connecter used to drive timeoutConnecter
// without pulling in any real connector's dependencies.
type fakeConnecter struct {
	mu sync.Mutex

	handler    http.Handler
	connectErr error

	// StorageMetadata forwarding inputs. fakeConnecter always implements
	// rest.StorageMetadata; leaving these zero models the "inner has no
	// metadata to report" case.
	mimes []string
	obj   any

	connectCalls int
	receivedCtx  context.Context
}

func (f *fakeConnecter) New() runtime.Object                               { return nil }
func (f *fakeConnecter) Destroy()                                          {}
func (f *fakeConnecter) ConnectMethods() []string                          { return []string{http.MethodGet} }
func (f *fakeConnecter) NewConnectOptions() (runtime.Object, bool, string) { return nil, false, "" }

func (f *fakeConnecter) Connect(ctx context.Context, _ string, _ runtime.Object, _ rest.Responder) (http.Handler, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.connectCalls++
	f.receivedCtx = ctx
	if f.connectErr != nil {
		return nil, f.connectErr
	}
	return f.handler, nil
}

func (f *fakeConnecter) ProducesMIMETypes(string) []string { return f.mimes }
func (f *fakeConnecter) ProducesObject(string) any         { return f.obj }

// fakeConnecterWithTimeout adds TimeoutProvider so tests can assert that a
// custom timeout from the inner overrides the default.
type fakeConnecterWithTimeout struct {
	fakeConnecter
	timeout time.Duration
}

func (f *fakeConnecterWithTimeout) Timeout() time.Duration { return f.timeout }

// recordingResponder captures whatever a handler reports.
type recordingResponder struct {
	mu      sync.Mutex
	err     error
	obj     any
	code    int
	written bool
}

func (r *recordingResponder) Error(err error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.err = err
	r.written = true
}

func (r *recordingResponder) Object(statusCode int, obj runtime.Object) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.code = statusCode
	r.obj = obj
	r.written = true
}

func TestTimeoutConnecter_RunsInnerHandler(t *testing.T) {
	called := false
	inner := &fakeConnecter{
		handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			called = true
			w.WriteHeader(http.StatusTeapot)
		}),
	}

	wrapped := WithTimeout(inner).(rest.Connecter)
	h, err := wrapped.Connect(context.Background(), "repo", nil, &recordingResponder{})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))

	require.True(t, called, "wrapper should invoke the inner handler")
	require.Equal(t, http.StatusTeapot, rr.Code, "inner handler's response should pass through")
}

func TestTimeoutConnecter_OverridesRequestContext(t *testing.T) {
	type ctxKey struct{}
	outerCtx := context.WithValue(context.Background(), ctxKey{}, "from-connect")

	var observedDeadline bool
	var observedValue any
	inner := &fakeConnecter{
		handler: http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			_, observedDeadline = r.Context().Deadline()
			observedValue = r.Context().Value(ctxKey{})
		}),
	}

	wrapped := WithTimeout(inner).(rest.Connecter)
	h, err := wrapped.Connect(outerCtx, "repo", nil, &recordingResponder{})
	require.NoError(t, err)

	// Request comes in with a context that has neither the deadline nor the
	// outer-Connect value, mirroring how k8s passes req in.
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	h.ServeHTTP(httptest.NewRecorder(), req)

	require.True(t, observedDeadline,
		"inner handler should see a deadline on r.Context() (wrapper overrode it with boundCtx)")
	require.Equal(t, "from-connect", observedValue,
		"inner handler should see values from the outer Connect ctx via r.Context()")
}

func TestTimeoutConnecter_HandlerSeesTimeoutCancellation(t *testing.T) {
	const timeout = 20 * time.Millisecond
	inner := &fakeConnecterWithTimeout{
		fakeConnecter: fakeConnecter{},
		timeout:       timeout,
	}

	done := make(chan struct{})
	inner.handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
		if errors.Is(r.Context().Err(), context.DeadlineExceeded) {
			w.WriteHeader(http.StatusGatewayTimeout)
		} else {
			w.WriteHeader(http.StatusInternalServerError)
		}
		close(done)
	})

	wrapped := WithTimeout(inner).(rest.Connecter)
	h, err := wrapped.Connect(context.Background(), "repo", nil, &recordingResponder{})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	start := time.Now()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
	elapsed := time.Since(start)

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("inner handler did not observe ctx cancellation")
	}

	require.GreaterOrEqual(t, elapsed, timeout,
		"handler should not return before the timeout fires")
	require.Less(t, elapsed, 500*time.Millisecond,
		"handler should return promptly after the timeout, took %s", elapsed)
	require.Equal(t, http.StatusGatewayTimeout, rr.Code,
		"inner handler should observe context.DeadlineExceeded once timeout fires")
}

func TestTimeoutConnecter_PropagatesConnectError(t *testing.T) {
	want := errors.New("inner refused")
	inner := &fakeConnecter{connectErr: want}

	wrapped := WithTimeout(inner).(rest.Connecter)
	h, err := wrapped.Connect(context.Background(), "repo", nil, &recordingResponder{})

	require.ErrorIs(t, err, want, "inner Connect error should bubble up")
	require.Nil(t, h, "wrapper should not return a handler when inner Connect fails")
}

// TestWithTimeoutFunc covers the standalone helper used by routes.go for
// extra (non-k8s-subresource) endpoints. The wrapper must put a deadline on
// r.Context() and the wrapped handler must observe cancellation when it
// blocks past the timeout.
func TestWithTimeoutFunc(t *testing.T) {
	t.Run("sets a deadline on r.Context()", func(t *testing.T) {
		const timeout = 50 * time.Millisecond
		var observed time.Duration
		var hasDeadline bool

		before := time.Now()
		h := WithTimeoutFunc(func(_ http.ResponseWriter, r *http.Request) {
			deadline, ok := r.Context().Deadline()
			hasDeadline = ok
			if ok {
				observed = deadline.Sub(before)
			}
		}, timeout)

		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

		require.True(t, hasDeadline, "wrapped handler should see a deadline on r.Context()")
		require.InDelta(t, timeout, observed, float64(20*time.Millisecond),
			"deadline should be ~%s from now, got %s", timeout, observed)
	})

	t.Run("handler observes timeout cancellation", func(t *testing.T) {
		const timeout = 20 * time.Millisecond

		h := WithTimeoutFunc(func(w http.ResponseWriter, r *http.Request) {
			<-r.Context().Done()
			if errors.Is(r.Context().Err(), context.DeadlineExceeded) {
				w.WriteHeader(http.StatusGatewayTimeout)
			} else {
				w.WriteHeader(http.StatusInternalServerError)
			}
		}, timeout)

		rr := httptest.NewRecorder()
		start := time.Now()
		h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
		elapsed := time.Since(start)

		require.Equal(t, http.StatusGatewayTimeout, rr.Code,
			"handler should observe context.DeadlineExceeded once timeout fires")
		require.GreaterOrEqual(t, elapsed, timeout,
			"handler should not return before the timeout fires")
		require.Less(t, elapsed, 500*time.Millisecond,
			"handler should return promptly after the timeout, took %s", elapsed)
	})
}

// TestTimeoutConnecter_DeadlineStartsAtConnect documents that the timeout
// clock starts when Connect() is called, not when the returned handler is
// invoked. We sleep between Connect() and ServeHTTP() and assert the
// deadline observed inside the handler is anchored to Connect-time, not
// ServeHTTP-time. If someone ever moves context.WithTimeout into the handler
// closure (handler-time semantics), this test fails.
func TestTimeoutConnecter_DeadlineStartsAtConnect(t *testing.T) {
	const timeout = 100 * time.Millisecond
	const gap = 30 * time.Millisecond

	var observed time.Time
	inner := &fakeConnecterWithTimeout{
		fakeConnecter: fakeConnecter{
			handler: http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				deadline, ok := r.Context().Deadline()
				require.True(t, ok, "handler should see a deadline on r.Context()")
				observed = deadline
			}),
		},
		timeout: timeout,
	}

	wrapped := WithTimeout(inner).(rest.Connecter)

	connectAt := time.Now()
	h, err := wrapped.Connect(context.Background(), "repo", nil, &recordingResponder{})
	require.NoError(t, err)

	time.Sleep(gap)

	serveAt := time.Now()
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))

	// Anchor at Connect: deadline ≈ connectAt + timeout.
	require.InDelta(t, timeout, observed.Sub(connectAt), float64(20*time.Millisecond),
		"deadline should be ~%s after Connect (clock starts at Connect)", timeout)

	// Equivalently: at ServeHTTP-time, the remaining budget is timeout - gap.
	// If the clock had started at ServeHTTP instead, remaining would be ~timeout.
	require.Less(t, observed.Sub(serveAt), timeout-gap/2,
		"remaining budget at ServeHTTP should reflect the pre-ServeHTTP gap")
}

func TestTimeoutConnecter_ForwardsStorageMetadata(t *testing.T) {
	// Zero fields on the inner: wrapper should forward to ProducesMIMETypes /
	// ProducesObject and return whatever the inner returns (nil here).
	empty := &fakeConnecter{handler: http.HandlerFunc(func(http.ResponseWriter, *http.Request) {})}
	wrapped := WithTimeout(empty).(rest.StorageMetadata)

	require.Nil(t, wrapped.ProducesMIMETypes(http.MethodGet))
	require.Nil(t, wrapped.ProducesObject(http.MethodGet))

	// Populated metadata: wrapper should pass the values through unchanged.
	populated := &fakeConnecter{
		handler: http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}),
		mimes:   []string{"application/test"},
		obj:     "the-object",
	}
	wrapped = WithTimeout(populated).(rest.StorageMetadata)

	require.Equal(t, []string{"application/test"}, wrapped.ProducesMIMETypes(http.MethodGet))
	require.Equal(t, "the-object", wrapped.ProducesObject(http.MethodGet))
}

var (
	_ rest.Storage         = (*fakeConnecter)(nil)
	_ rest.Connecter       = (*fakeConnecter)(nil)
	_ rest.StorageMetadata = (*fakeConnecter)(nil)

	_ rest.Storage    = (*fakeConnecterWithTimeout)(nil)
	_ rest.Connecter  = (*fakeConnecterWithTimeout)(nil)
	_ TimeoutProvider = (*fakeConnecterWithTimeout)(nil)
)
