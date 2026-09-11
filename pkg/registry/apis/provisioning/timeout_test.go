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
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
)

// fakeConnector implements rest.Connecter used to drive timeoutConnecter
// without pulling in any real connector's dependencies.
type fakeConnector struct {
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

func (f *fakeConnector) New() runtime.Object                               { return nil }
func (f *fakeConnector) Destroy()                                          {}
func (f *fakeConnector) ConnectMethods() []string                          { return []string{http.MethodGet} }
func (f *fakeConnector) NewConnectOptions() (runtime.Object, bool, string) { return nil, false, "" }

func (f *fakeConnector) Connect(ctx context.Context, _ string, _ runtime.Object, _ rest.Responder) (http.Handler, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.connectCalls++
	f.receivedCtx = ctx
	if f.connectErr != nil {
		return nil, f.connectErr
	}
	return f.handler, nil
}

func (f *fakeConnector) ProducesMIMETypes(string) []string { return f.mimes }
func (f *fakeConnector) ProducesObject(string) any         { return f.obj }

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

func TestWithTimeout_RunsInnerHandler(t *testing.T) {
	called := false
	inner := &fakeConnector{
		handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			called = true
			w.WriteHeader(http.StatusTeapot)
		}),
	}

	wrapped := WithTimeout(inner, 30*time.Second).(rest.Connecter)
	h, err := wrapped.Connect(context.Background(), "repo", nil, &recordingResponder{})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))

	require.True(t, called, "wrapper should invoke the inner handler")
	require.Equal(t, http.StatusTeapot, rr.Code, "inner handler's response should pass through")
}

// TestWithTimeout_PreservesRequestContext locks down the request-anchored
// design: boundCtx must descend from r.Context() (so filter-populated values
// like userInfo/requestInfo survive), and the namespace from the outer Connect
// ctx must be forwarded onto the bound ctx.
func TestWithTimeout_PreservesRequestContext(t *testing.T) {
	type filterKey struct{}

	var observedDeadline bool
	var observedFilterValue any
	var observedNamespace string
	var observedNamespaceOK bool

	inner := &fakeConnector{
		handler: http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			_, observedDeadline = r.Context().Deadline()
			observedFilterValue = r.Context().Value(filterKey{})
			observedNamespace, observedNamespaceOK = request.NamespaceFrom(r.Context())
		}),
	}

	// Mirror production: the outer Connect ctx has a namespace (k8s adds it in
	// ConnectResource) but no filter-added values. The inbound request has the
	// filter-added values but not the namespace.
	connectCtx := request.WithNamespace(context.Background(), "ns-from-connect")

	wrapped := WithTimeout(inner, 30*time.Second).(rest.Connecter)
	h, err := wrapped.Connect(connectCtx, "repo", nil, &recordingResponder{})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req = req.WithContext(context.WithValue(req.Context(), filterKey{}, "from-filter"))
	h.ServeHTTP(httptest.NewRecorder(), req)

	require.True(t, observedDeadline,
		"inner handler should see a deadline on r.Context() (wrapper bounded it with timeout)")
	require.Equal(t, "from-filter", observedFilterValue,
		"values on the inbound request's context must survive — boundCtx descends from r.Context()")
	require.True(t, observedNamespaceOK,
		"namespace from the outer Connect ctx must reach the inner handler")
	require.Equal(t, "ns-from-connect", observedNamespace,
		"namespace forwarded onto boundCtx must match the one on the Connect ctx")
}

func TestWithTimeout_HandlerSeesTimeoutCancellation(t *testing.T) {
	const timeout = 20 * time.Millisecond
	inner := &fakeConnector{}

	// The handler blocks until r.Context() is canceled and reports which kind
	// of cancellation it saw via the response status. 504 means the deadline
	// fired (what we want); 500 would mean some other cancellation cause.
	inner.handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
		if errors.Is(r.Context().Err(), context.DeadlineExceeded) {
			w.WriteHeader(http.StatusGatewayTimeout)
		} else {
			w.WriteHeader(http.StatusInternalServerError)
		}
	})

	wrapped := WithTimeout(inner, timeout).(rest.Connecter)
	h, err := wrapped.Connect(context.Background(), "repo", nil, &recordingResponder{})
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))

	require.Equal(t, http.StatusGatewayTimeout, rr.Code,
		"inner handler should observe context.DeadlineExceeded once timeout fires")
}

func TestWithTimeout_PropagatesConnectError(t *testing.T) {
	want := errors.New("inner refused")
	inner := &fakeConnector{connectErr: want}

	wrapped := WithTimeout(inner, 30*time.Second).(rest.Connecter)
	responder := &recordingResponder{}
	h, err := wrapped.Connect(context.Background(), "repo", nil, responder)

	require.NoError(t, err, "outer Connect should succeed; inner runs at request time")
	require.NotNil(t, h, "outer Connect should always return a handler")

	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/", nil))
	require.ErrorIs(t, responder.err, want, "inner Connect error should reach responder.Error")
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

func TestWithTimeout_ForwardsStorageMetadata(t *testing.T) {
	// Zero fields on the inner: wrapper should forward to ProducesMIMETypes /
	// ProducesObject and return whatever the inner returns (nil here).
	empty := &fakeConnector{handler: http.HandlerFunc(func(http.ResponseWriter, *http.Request) {})}
	wrapped := WithTimeout(empty, 30*time.Second).(rest.StorageMetadata)

	require.Nil(t, wrapped.ProducesMIMETypes(http.MethodGet))
	require.Nil(t, wrapped.ProducesObject(http.MethodGet))

	// Populated metadata: wrapper should pass the values through unchanged.
	populated := &fakeConnector{
		handler: http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}),
		mimes:   []string{"application/test"},
		obj:     "the-object",
	}
	wrapped = WithTimeout(populated, time.Second).(rest.StorageMetadata)

	require.Equal(t, []string{"application/test"}, wrapped.ProducesMIMETypes(http.MethodGet))
	require.Equal(t, "the-object", wrapped.ProducesObject(http.MethodGet))
}

var (
	_ rest.Storage         = (*fakeConnector)(nil)
	_ rest.Connecter       = (*fakeConnector)(nil)
	_ rest.StorageMetadata = (*fakeConnector)(nil)
)
