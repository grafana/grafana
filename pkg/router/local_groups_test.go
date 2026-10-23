package router

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	apiregistrationv1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"
)

// fakeAPIServer serves what the router reads from the embedded API server.
type fakeAPIServer struct {
	*httptest.Server
	ready atomic.Bool
	// apiServices are the groups of the aggregator's APIServices; nil means no aggregator.
	apiServices []string
}

func newFakeAPIServer(t *testing.T, aggregated bool, groups ...string) *fakeAPIServer {
	t.Helper()
	f := &fakeAPIServer{}
	f.ready.Store(true)
	f.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/readyz":
			if !f.ready.Load() {
				http.Error(w, "not ready", http.StatusInternalServerError)
				return
			}
			_, _ = w.Write([]byte("ok"))
		case apiServicesPath:
			if f.apiServices == nil {
				http.NotFound(w, r)
				return
			}
			var list apiregistrationv1.APIServiceList
			for _, g := range f.apiServices {
				list.Items = append(list.Items, apiregistrationv1.APIService{Spec: apiregistrationv1.APIServiceSpec{Group: g}})
			}
			_ = json.NewEncoder(w).Encode(list)
		case apisPrefix:
			require.Contains(t, r.Header.Get("Accept"), "as=APIGroupDiscoveryList")
			serveLocalDiscovery(w, aggregated, groups)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(f.Close)
	return f
}

func serveLocalDiscovery(w http.ResponseWriter, aggregated bool, groups []string) {
	var body any
	if aggregated {
		w.Header().Set("Content-Type", aggregatedDiscoveryJSON)
		items := make([]map[string]any, 0, len(groups))
		for _, g := range groups {
			items = append(items, map[string]any{
				"metadata": map[string]any{"name": g},
				"versions": []map[string]any{{"version": "v1"}},
			})
		}
		body = map[string]any{"kind": "APIGroupDiscoveryList", "apiVersion": "apidiscovery.k8s.io/v2", "items": items}
	} else {
		w.Header().Set("Content-Type", "application/json")
		list := metav1.APIGroupList{TypeMeta: metav1.TypeMeta{Kind: "APIGroupList", APIVersion: "v1"}}
		for _, g := range groups {
			list.Groups = append(list.Groups, metav1.APIGroup{Name: g, Versions: []metav1.GroupVersionForDiscovery{{GroupVersion: g + "/v1", Version: "v1"}}})
		}
		body = list
	}
	_ = json.NewEncoder(w).Encode(body)
}

func TestLocalGroupsLoad(t *testing.T) {
	for name, aggregated := range map[string]bool{"aggregated": true, "legacy": false} {
		t.Run(name, func(t *testing.T) {
			srv := newFakeAPIServer(t, aggregated, "dashboard.grafana.app")
			local := newLocalGroups()
			require.False(t, local.absent("other.grafana.app"), "nothing is absent before the snapshot")

			require.NoError(t, local.load(t.Context(), srv.Client(), srv.URL))
			require.True(t, local.absent("other.grafana.app"))
			require.False(t, local.absent("dashboard.grafana.app"))
		})
	}
}

// A remote group whose service is down is missing from discovery, but the
// aggregator still answers for it, so it must not be sent to the MT router.
func TestLocalGroupsIncludeRemoteAPIServices(t *testing.T) {
	srv := newFakeAPIServer(t, true, "dashboard.grafana.app")
	srv.apiServices = []string{"dashboard.grafana.app", "down.ext.grafana.com"}
	local := newLocalGroups()
	require.NoError(t, local.load(t.Context(), srv.Client(), srv.URL))
	require.False(t, local.absent("down.ext.grafana.com"))
	require.True(t, local.absent("other.grafana.app"))
}

func TestLocalGroupsWaitForReady(t *testing.T) {
	srv := newFakeAPIServer(t, true, "dashboard.grafana.app")
	srv.ready.Store(false)
	local := newLocalGroups()
	require.ErrorIs(t, local.load(t.Context(), srv.Client(), srv.URL), errAPIServerNotReady)
	require.False(t, local.absent("other.grafana.app"), "an unready server leaves nothing absent")
}

func TestLocalGroupsRunStopsAfterSnapshot(t *testing.T) {
	srv := newFakeAPIServer(t, true, "dashboard.grafana.app")
	local := newLocalGroups()
	done := make(chan struct{})
	go func() {
		defer close(done)
		local.run(t.Context(), srv.Client(), srv.URL)
	}()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("run kept polling after the snapshot succeeded")
	}
	require.True(t, local.absent("other.grafana.app"))
}

func TestSingleTenantFallbackRefusesRequestsThatAlreadyCrossed(t *testing.T) {
	for _, origin := range []string{originST, originMT, "somebody-else"} {
		t.Run(origin, func(t *testing.T) {
			st := newTestSingleTenantFallback(t)
			st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
				t.Error("a refused request must not reach a stack lookup")
				return singleTenantStack{}, errors.New("unexpected lookup")
			}
			req := httptest.NewRequest(http.MethodGet, "/apis/remote.grafana.app/v1/namespaces/stacks-1/things", nil)
			req.Header.Set(routerOriginHeader, origin)
			recorder := httptest.NewRecorder()
			st.ServeHTTP(recorder, req)
			require.Equal(t, http.StatusNotFound, recorder.Code)
			require.Equal(t, uint64(1), st.fallbackRefused.Load())
		})
	}
}
