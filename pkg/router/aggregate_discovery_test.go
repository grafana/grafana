package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

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
