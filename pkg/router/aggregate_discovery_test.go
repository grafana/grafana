package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestDiscoverGroups(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/apis", r.URL.Path)
		list := metav1.APIGroupList{
			Groups: []metav1.APIGroup{
				{Name: "dashboard.grafana.app"},
				{Name: "coordination.k8s.io"},
			},
		}
		_ = json.NewEncoder(w).Encode(list)
	}))
	defer srv.Close()

	groups, err := discoverGroups(t.Context(), srv.Client(), srv.URL)
	require.NoError(t, err)
	require.Len(t, groups, 2)
	require.Equal(t, "dashboard.grafana.app", groups[0].Name)
}

func TestDiscoverGroups_NonOKStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	_, err := discoverGroups(t.Context(), srv.Client(), srv.URL)
	require.Error(t, err)
}

// TestDiscoverGroups_ClientTimeoutFires proves that a *http.Client with a
// Timeout set (as rest.HTTPClientFor now produces via rest.Config.Timeout in
// cloud_router.go) bounds discoverGroups even when the upstream completes
// the handshake and then never responds -- the scenario that previously hung
// poll() forever because the zero-value rest.Config.Timeout produced a
// client with no deadline at all.
func TestDiscoverGroups_ClientTimeoutFires(t *testing.T) {
	block := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-block // never responds until the test unblocks it below
	}))
	defer func() {
		close(block) // let the handler return so srv.Close() doesn't hang
		srv.Close()
	}()

	client := &http.Client{Timeout: 50 * time.Millisecond}

	done := make(chan error, 1)
	go func() {
		_, err := discoverGroups(t.Context(), client, srv.URL)
		done <- err
	}()

	select {
	case err := <-done:
		require.Error(t, err, "discoverGroups must return an error once the client timeout fires, not hang")
	case <-time.After(5 * time.Second):
		t.Fatal("discoverGroups did not return within 5s of the 50ms client timeout -- timeout is not being enforced")
	}
}

func TestAggregateBackend_ProxiesToTargetHost(t *testing.T) {
	var gotPath string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer upstream.Close()

	base, err := url.Parse(upstream.URL)
	require.NoError(t, err)

	group := metav1.APIGroup{Name: "dashboard.grafana.app"}
	backend, err := newAggregateBackend("baas_apiserver", group, base, http.DefaultTransport)
	require.NoError(t, err)
	require.Equal(t, group, backend.Group())
	require.NotEmpty(t, backend.Key())

	handler, err := backend.Load(t.Context())
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "/apis/dashboard.grafana.app/v1", gotPath)
}
