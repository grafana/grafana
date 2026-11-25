package rawroutes

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type provider struct{ routes []Route }

func (p provider) RawRoutes() []Route { return p.routes }

func TestCollect(t *testing.T) {
	gv := schema.GroupVersion{Group: "live.grafana.app", Version: "v1alpha1"}
	ws := Route{API: gv, Namespaced: true, Method: http.MethodGet, Path: "ws"}
	push := Route{API: gv, Namespaced: true, Method: http.MethodPost, Path: "push"}

	items := []any{
		provider{routes: []Route{ws}},
		"not a provider",
		provider{routes: []Route{push}},
	}

	require.Equal(t, []Route{ws, push}, Collect(items))
	require.Empty(t, Collect([]any{"none"}))
}

func TestNewHandler(t *testing.T) {
	gv := schema.GroupVersion{Group: "live.grafana.app", Version: "v1alpha1"}
	var gotNamespace string
	ws := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotNamespace = r.PathValue("namespace")
		w.WriteHeader(http.StatusSwitchingProtocols)
	})
	status := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })

	h, err := NewHandler(next, []Route{
		{API: gv, Namespaced: true, Method: http.MethodGet, Path: "ws", Handler: ws},
		{API: gv, Method: http.MethodGet, Path: "status", Handler: status},
	})
	require.NoError(t, err)

	tests := []struct {
		method, path string
		want         int
	}{
		{http.MethodGet, "/apis/live.grafana.app/v1alpha1/namespaces/stacks-1/ws", http.StatusSwitchingProtocols},
		{http.MethodGet, "/apis/live.grafana.app/v1alpha1/status", http.StatusOK},
		// Everything else, including other methods on a raw route path, goes to next.
		{http.MethodPost, "/apis/live.grafana.app/v1alpha1/namespaces/stacks-1/ws", http.StatusTeapot},
		{http.MethodGet, "/apis/live.grafana.app/v1alpha1/namespaces/stacks-1/channels", http.StatusTeapot},
		{http.MethodGet, "/apis/dashboard.grafana.app/v1", http.StatusTeapot},
	}
	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(tt.method, tt.path, nil))
			require.Equal(t, tt.want, rec.Code)
		})
	}
	require.Equal(t, "stacks-1", gotNamespace)

	t.Run("no routes returns next", func(t *testing.T) {
		h, err := NewHandler(next, nil)
		require.NoError(t, err)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/apis", nil))
		require.Equal(t, http.StatusTeapot, rec.Code)
	})

	t.Run("invalid routes", func(t *testing.T) {
		_, err := NewHandler(next, []Route{{API: gv, Method: http.MethodGet, Path: "ws"}})
		require.Error(t, err, "missing handler")
		_, err = NewHandler(next, []Route{
			{API: gv, Method: http.MethodGet, Path: "ws", Handler: ws},
			{API: gv, Method: http.MethodGet, Path: "ws", Handler: ws},
		})
		require.Error(t, err, "duplicate")
	})
}
