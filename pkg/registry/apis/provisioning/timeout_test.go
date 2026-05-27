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

	v0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func TestWithTimeout(t *testing.T) {
	handler := CtxHandlerFunc(func(ctx context.Context, w http.ResponseWriter, r *http.Request) {
		select {
		case <-ctx.Done():
			w.WriteHeader(http.StatusGatewayTimeout)
		case <-time.After(50 * time.Millisecond):
			w.WriteHeader(http.StatusOK)
		}
	})

	tests := []struct {
		name       string
		timeout    time.Duration
		wantStatus int
	}{
		{
			name:       "request completes",
			timeout:    100 * time.Millisecond,
			wantStatus: http.StatusOK,
		},
		{
			name:       "request times out",
			timeout:    10 * time.Millisecond,
			wantStatus: http.StatusGatewayTimeout,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			r := httptest.NewRequest("GET", "/", nil)
			WithTimeout(context.Background(), handler, tt.timeout).ServeHTTP(w, r)
			require.Equal(t, tt.wantStatus, w.Code)
		})
	}
}

// blockingMock is a shared helper used by the per-connector timeout tests
// below. Each backend method ultimately calls block(ctx), which waits for the
// context to be cancelled and records the resulting error so the test can
// assert that the timeout-bounded ctx reached the call site.
type blockingMock struct {
	mu  sync.Mutex
	err error
}

func (m *blockingMock) block(ctx context.Context) error {
	<-ctx.Done()
	m.mu.Lock()
	defer m.mu.Unlock()
	m.err = ctx.Err()
	return ctx.Err()
}

func (m *blockingMock) observed() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.err
}

// blockingLister adapts blockingMock to resources.ResourceLister so the
// list connector can be wired against it.
type blockingLister struct{ m *blockingMock }

func (b *blockingLister) List(ctx context.Context, namespace, repository string) (*v0alpha1.ResourceList, error) {
	return nil, b.m.block(ctx)
}

func (b *blockingLister) Stats(ctx context.Context, namespace, repository string) (*v0alpha1.ResourceStats, error) {
	return nil, b.m.block(ctx)
}

// recordingResponder captures whatever the handler reports so the test can
// assert how the connector translated the timeout into an HTTP response.
type recordingResponder struct {
	mu    sync.Mutex
	err   error
	obj   any
	code  int
	wroth bool
}

func (r *recordingResponder) Error(err error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.err = err
	r.wroth = true
}

func (r *recordingResponder) Object(statusCode int, obj runtime.Object) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.code = statusCode
	r.obj = obj
	r.wroth = true
}

func (r *recordingResponder) didRespond() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.wroth
}

// timeoutTestCase is one row in the table-driven connector test. The factory
// builds a connector wired to the shared blocking mock with the requested
// timeout. Adding a new connector is a matter of adding one entry here plus
// an adapter on blockingMock above if the connector uses a backend interface
// not yet represented.
type timeoutTestCase struct {
	name    string
	build   func(t *testing.T, m *blockingMock, timeout time.Duration) rest.Connecter
	connect func(t *testing.T, c rest.Connecter) (http.Handler, *recordingResponder)
}

func TestConnectorRespectsTimeout(t *testing.T) {
	tests := []timeoutTestCase{
		{
			name: "list",
			build: func(t *testing.T, m *blockingMock, timeout time.Duration) rest.Connecter {
				_ = t
				return NewListConnector(nil, &blockingLister{m: m}, &timeout)
			},
			connect: connectWithNamespace,
		},
		// To add another connector:
		//   1. Add an adapter on blockingMock above that implements the
		//      connector's backend interface and forwards to block(ctx).
		//   2. Add an entry here that constructs the connector via its New*
		//      function with the blocking adapter and the given timeout.
		//   3. If the connector's Connect() expects something beyond a
		//      namespace on the context, supply a custom `connect` helper.
		//
		// {name: "jobs", build: ..., connect: connectWithNamespace},
		// {name: "files", ...},
		// {name: "test", ...},
		// {name: "refs", ...},
		// {name: "connection-repositories", ...},
		// {name: "render", ...},
		// {name: "webhook", ...},
		// {name: "history", ...},
	}

	const requestTimeout = 10 * time.Millisecond
	// The assertion gives the handler well above the timeout to complete, so
	// a flaky scheduler doesn't fail the test, but well below 30s so we'd
	// catch a regression where the deadline isn't propagated and the
	// downstream call blocks indefinitely.
	const maxHandlerDuration = 500 * time.Millisecond

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &blockingMock{}
			c := tt.build(t, mock, requestTimeout)

			h, responder := tt.connect(t, c)

			req := httptest.NewRequest(http.MethodGet, "/", nil)
			rr := httptest.NewRecorder()

			start := time.Now()
			h.ServeHTTP(rr, req)
			elapsed := time.Since(start)

			require.Less(t, elapsed, maxHandlerDuration,
				"handler should return promptly once the timeout fires, took %s", elapsed)
			require.True(t, responder.didRespond(),
				"handler should write a response (error or object)")
			require.True(t,
				errors.Is(mock.observed(), context.DeadlineExceeded) ||
					errors.Is(mock.observed(), context.Canceled),
				"downstream backend call should observe ctx cancellation, got %v", mock.observed())
		})
	}
}

// connectWithNamespace is the default helper for connectors whose Connect()
// only requires a namespace on the inbound context. It returns the produced
// http.Handler and a fresh recordingResponder bound to it.
func connectWithNamespace(t *testing.T, c rest.Connecter) (http.Handler, *recordingResponder) {
	t.Helper()
	responder := &recordingResponder{}
	ctx := request.WithNamespace(context.Background(), "default")
	h, err := c.Connect(ctx, "repo-name", nil, responder)
	require.NoError(t, err)
	require.NotNil(t, h)
	return h, responder
}

// Compile-time assurance the resource lister adapter satisfies the interface
// the list connector depends on.
var _ resources.ResourceLister = (*blockingLister)(nil)
