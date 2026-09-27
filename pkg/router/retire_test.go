package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// destroyableHandler records when it is destroyed. It blocks each request
// until release is closed, when release is set.
type destroyableHandler struct {
	name      string
	release   chan struct{}
	started   chan struct{}
	destroyed chan struct{}
	served    atomic.Int32
}

func newDestroyableHandler(name string) *destroyableHandler {
	return &destroyableHandler{name: name, started: make(chan struct{}, 1), destroyed: make(chan struct{})}
}

func (h *destroyableHandler) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	select {
	case <-h.destroyed:
		panic("served by a destroyed handler")
	default:
	}
	h.served.Add(1)
	h.started <- struct{}{}
	if h.release != nil {
		<-h.release
	}
	_, _ = w.Write([]byte(h.name))
}

func (h *destroyableHandler) Destroy() { close(h.destroyed) }

type swapLoader struct{ backends atomic.Pointer[[]Backend] }

func (l *swapLoader) set(backends ...Backend) { l.backends.Store(&backends) }
func (l *swapLoader) Load(context.Context) ([]Backend, error) {
	return *l.backends.Load(), nil
}
func (l *swapLoader) Notify(context.Context) (<-chan struct{}, error) {
	return make(chan struct{}), nil
}

func destroyableBackend(key string, h *destroyableHandler) Backend {
	return &fakeBackend{group: metav1.APIGroup{Name: "retire.ext.grafana.app"}, key: key, handler: h}
}

func waitDestroyed(t *testing.T, h *destroyableHandler) {
	t.Helper()
	select {
	case <-h.destroyed:
	case <-time.After(5 * time.Second):
		t.Fatalf("handler %s was not destroyed", h.name)
	}
}

func requireNotDestroyed(t *testing.T, h *destroyableHandler) {
	t.Helper()
	select {
	case <-h.destroyed:
		t.Fatalf("handler %s was destroyed while in use", h.name)
	case <-time.After(50 * time.Millisecond):
	}
}

func TestRetiredHandlerIsDestroyedAfterItsLastRequest(t *testing.T) {
	const path = "/apis/retire.ext.grafana.app/v1/things"
	old := newDestroyableHandler("old")
	old.release = make(chan struct{})
	loader := &swapLoader{}
	loader.set(destroyableBackend("1", old))
	router := NewGrafanaRouter(loader)
	require.NoError(t, router.reconcile(t.Context()))

	inFlight := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		defer close(done)
		router.HandleFunc(inFlight, httptest.NewRequest(http.MethodGet, path, nil), http.NotFoundHandler())
	}()
	<-old.started

	replacement := newDestroyableHandler("new")
	loader.set(destroyableBackend("2", replacement))
	require.NoError(t, router.reconcile(t.Context()))
	requireNotDestroyed(t, old)

	// New requests reach the replacement while the old one finishes.
	recorder := httptest.NewRecorder()
	router.HandleFunc(recorder, httptest.NewRequest(http.MethodGet, path, nil), http.NotFoundHandler())
	require.Equal(t, "new", recorder.Body.String())

	close(old.release)
	<-done
	require.Equal(t, "old", inFlight.Body.String())
	waitDestroyed(t, old)

	// Removing the group destroys its handler at once when nothing is in flight.
	loader.set()
	require.NoError(t, router.reconcile(t.Context()))
	waitDestroyed(t, replacement)
}

func TestRetiredEntryRefusesNewRequests(t *testing.T) {
	old := newDestroyableHandler("old")
	loader := &swapLoader{}
	loader.set(destroyableBackend("1", old))
	router := NewGrafanaRouter(loader)
	require.NoError(t, router.reconcile(t.Context()))
	stale := (*router.snapshot.Load())["retire.ext.grafana.app"]

	loader.set(destroyableBackend("2", newDestroyableHandler("new")))
	require.NoError(t, router.reconcile(t.Context()))
	waitDestroyed(t, old)

	// A request that looked the entry up before it was retired must not run
	// on the destroyed handler.
	recorder := httptest.NewRecorder()
	stale.serve("retire.ext.grafana.app", recorder, httptest.NewRequest(http.MethodGet, "/apis/retire.ext.grafana.app", nil))
	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	require.Equal(t, "1", recorder.Header().Get("Retry-After"))
	require.Zero(t, old.served.Load())
}

func TestHandlersWithoutTeardownAreNotTracked(t *testing.T) {
	loader := &swapLoader{}
	loader.set(&fakeBackend{group: metav1.APIGroup{Name: "plain.ext.grafana.app"}, key: "1"})
	router := NewGrafanaRouter(loader)
	require.NoError(t, router.reconcile(t.Context()))
	require.Nil(t, router.served["plain.ext.grafana.app"].use)
}

func TestAuthenticatingWrapperDestroysItsHandler(t *testing.T) {
	inner := newDestroyableHandler("inner")
	released := 0
	wrapper := &authenticatingWrapper{Handler: inner, release: func() { released++ }}
	var d destroyer = wrapper
	d.Destroy()
	waitDestroyed(t, inner)
	require.Equal(t, 1, released)
}
