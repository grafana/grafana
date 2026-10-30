package router

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const retireGroup = "retire.ext.grafana.app"

// destroyableHandler records when it is destroyed. A request blocks until
// release is closed, when release is set, or until the request ends, when
// untilDone is set.
type destroyableHandler struct {
	name      string
	release   chan struct{}
	untilDone bool
	started   chan struct{}
	destroyed chan struct{}
	served    atomic.Int32
}

func newDestroyableHandler(name string) *destroyableHandler {
	return &destroyableHandler{name: name, started: make(chan struct{}, 1), destroyed: make(chan struct{})}
}

func (h *destroyableHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	select {
	case <-h.destroyed:
		panic("served by a destroyed handler")
	default:
	}
	h.served.Add(1)
	h.started <- struct{}{}
	switch {
	case h.untilDone:
		<-req.Context().Done()
	case h.release != nil:
		<-h.release
	}
	_, _ = w.Write([]byte(h.name)) // nolint:gosec // G705: XSS via taint analysis (gosec)
}

func (h *destroyableHandler) Destroy() { close(h.destroyed) }

func destroyableBackend(key string, h *destroyableHandler) Backend {
	return &fakeBackend{group: metav1.APIGroup{Name: retireGroup}, key: key, handler: h}
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
	const path = "/apis/" + retireGroup + "/v1/namespaces/default/things"
	old := newDestroyableHandler("old")
	old.release = make(chan struct{})
	loader := &mutableLoader{backends: []Backend{destroyableBackend("1", old)}}
	router := NewGrafanaRouter(loader, nil)
	require.NoError(t, router.reconcile(t.Context()))

	inFlight := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		defer close(done)
		router.HandleFunc(inFlight, newAuthenticatedRequest(http.MethodGet, path, nil))
	}()
	<-old.started

	replacement := newDestroyableHandler("new")
	loader.backends = []Backend{destroyableBackend("2", replacement)}
	require.NoError(t, router.reconcile(t.Context()))
	requireNotDestroyed(t, old)

	// New requests reach the replacement while the old one finishes.
	recorder := httptest.NewRecorder()
	router.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, path, nil))
	require.Equal(t, "new", recorder.Body.String())

	close(old.release)
	<-done
	require.Equal(t, "old", inFlight.Body.String())
	waitDestroyed(t, old)

	// Removing the group destroys its handler at once when nothing is in flight.
	loader.backends = nil
	require.NoError(t, router.reconcile(t.Context()))
	waitDestroyed(t, replacement)
}

// A watch on a retired handler ends, so it never keeps the handler alive.
func TestRetiredHandlerEndsItsWatchesBeforeItIsDestroyed(t *testing.T) {
	old := newDestroyableHandler("old")
	old.untilDone = true
	loader := &mutableLoader{backends: []Backend{destroyableBackend("1", old)}}
	router := NewGrafanaRouter(loader, nil)
	require.NoError(t, router.reconcile(t.Context()))

	done := make(chan struct{})
	go func() {
		defer close(done)
		req := newAuthenticatedRequest(http.MethodGet, "/apis/"+retireGroup+"/v1/namespaces/default/things?watch=true", nil)
		router.HandleFunc(httptest.NewRecorder(), req)
	}()
	<-old.started

	loader.backends = []Backend{destroyableBackend("2", newDestroyableHandler("new"))}
	require.NoError(t, router.reconcile(t.Context()))
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("the watch did not end when its handler was retired")
	}
	waitDestroyed(t, old)
}

func TestRetiredEntryRefusesNewRequests(t *testing.T) {
	old := newDestroyableHandler("old")
	loader := &mutableLoader{backends: []Backend{destroyableBackend("1", old)}}
	router := NewGrafanaRouter(loader, nil)
	require.NoError(t, router.reconcile(t.Context()))
	stale := (*router.snapshot.Load())[retireGroup]

	loader.backends = []Backend{destroyableBackend("2", newDestroyableHandler("new"))}
	require.NoError(t, router.reconcile(t.Context()))
	waitDestroyed(t, old)

	// A request that looked the entry up before it was retired must not run
	// on the destroyed handler.
	recorder := httptest.NewRecorder()
	stale.serve(retireGroup, recorder, newAuthenticatedRequest(http.MethodGet, "/apis/"+retireGroup, nil))
	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	require.Equal(t, "1", recorder.Header().Get("Retry-After"))
	require.Zero(t, old.served.Load())
}

func TestHandlersWithoutTeardownAreNotTracked(t *testing.T) {
	loader := &mutableLoader{backends: []Backend{&fakeBackend{group: metav1.APIGroup{Name: "plain.ext.grafana.app"}, key: "1"}}}
	router := NewGrafanaRouter(loader, nil)
	require.NoError(t, router.reconcile(t.Context()))
	require.Nil(t, router.served["plain.ext.grafana.app"].use)
}
