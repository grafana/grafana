package router

import (
	"context"
	"encoding/json"
	"encoding/pem"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	apiregistrationv1 "k8s.io/kube-aggregator/pkg/apis/apiregistration/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
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

func TestMiddlewareForwardsUnknownGroupsToMT(t *testing.T) {
	var gotMarker, gotAuth, gotPath string
	mt := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMarker, gotAuth, gotPath = r.Header.Get(stFallbackHeader), r.Header.Get("X-Access-Token"), r.URL.Path
		w.WriteHeader(http.StatusAccepted)
	}))
	defer mt.Close()

	cfg := setting.NewCfg()
	cfg.Raw.Section(cloudRouterSection).Key(mtRouterAddressKey).SetValue(mt.URL)
	loader, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.NotNil(t, loader, "mt_router_address alone configures the cloud loader")
	svc, err := provideTestService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware), loader)
	require.NoError(t, err)
	require.NotNil(t, svc.mt)
	require.NoError(t, svc.router.reconcile(t.Context()))

	embedded := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	serve := func(target string, hop bool) int {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, target, nil)
		if hop {
			req.Header.Set(stFallbackHeader, stFallbackValue)
		}
		req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{AccessToken: "tok"}))
		svc.HandleFunc(recorder, req, embedded)
		return recorder.Code
	}
	const unknown = "/apis/remote.grafana.app/v1/namespaces/default/things"
	const local = "/apis/dashboard.grafana.app/v1/namespaces/default/dashboards"

	// Fail closed: with no local discovery yet, nothing leaves the process.
	require.Equal(t, http.StatusTeapot, serve(unknown, false))

	srv := newFakeAPIServer(t, true, "dashboard.grafana.app")
	require.NoError(t, svc.mt.local.load(t.Context(), srv.Client(), srv.URL))

	require.Equal(t, http.StatusAccepted, serve(unknown, false))
	require.Equal(t, stFallbackValue, gotMarker)
	require.Equal(t, "Bearer tok", gotAuth)
	require.Equal(t, unknown, gotPath)

	require.Equal(t, http.StatusTeapot, serve(local, false))
	// A request that already crossed once is not forwarded again.
	require.Equal(t, http.StatusTeapot, serve(unknown, true))
}

func TestMTRouterAddressMustBeAbsoluteURL(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Raw.Section(cloudRouterSection).Key(mtRouterAddressKey).SetValue("mt-router:3000")
	_, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.ErrorContains(t, err, mtRouterAddressKey)
}

func TestMTRouterTLS(t *testing.T) {
	mt := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusAccepted) }))
	defer mt.Close()
	caFile := filepath.Join(t.TempDir(), "ca.pem")
	require.NoError(t, os.WriteFile(caFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: mt.Certificate().Raw}), 0o600))

	forward := func(t *testing.T, caFile string, insecure bool) int {
		t.Helper()
		m, err := newMTFallback(mt.URL, caFile, insecure)
		require.NoError(t, err)
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/apis/remote.grafana.app/v1/namespaces/default/things", nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{}))
		m.serve(recorder, req, "remote.grafana.app")
		return recorder.Code
	}

	// An untrusted certificate fails without a CA, and passes with it or when verification is skipped.
	require.Equal(t, http.StatusBadGateway, forward(t, "", false))
	require.Equal(t, http.StatusAccepted, forward(t, caFile, false))
	require.Equal(t, http.StatusAccepted, forward(t, "", true))
}

func TestMTRouterTLSValidation(t *testing.T) {
	_, err := newMTFallback("https://mt-router:3000", "/some/ca.pem", true)
	require.ErrorContains(t, err, mtRouterCAFileKey)
	require.ErrorContains(t, err, mtRouterInsecureKey)

	_, err = newMTFallback("https://mt-router:3000", filepath.Join(t.TempDir(), "missing.pem"), false)
	require.ErrorContains(t, err, "ca_file")

	bad := filepath.Join(t.TempDir(), "bad.pem")
	require.NoError(t, os.WriteFile(bad, []byte("not pem"), 0o600))
	_, err = newMTFallback("https://mt-router:3000", bad, false)
	require.ErrorContains(t, err, "invalid CA PEM")
}

// Without the cloud loader, which only a configured address creates, the
// service never forwards: the behavior is absent from OSS.
func TestMTFallbackNeedsCloudLoader(t *testing.T) {
	cfg := setting.NewCfg()
	loader, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	require.Nil(t, loader)

	svc, err := provideTestService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware), &mutableLoader{})
	require.NoError(t, err)
	require.Nil(t, svc.mt)
}

// The standalone router target is the multi-tenant router itself.
func TestMTFallbackNotInStandaloneRouter(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Target = []string{"router"}
	cfg.Raw.Section(cloudRouterSection).Key(mtRouterAddressKey).SetValue("http://mt-router:3000")
	loader, err := ProvideCloudRoutesLoaderFactory(cfg, PluginDependencies{})
	require.NoError(t, err)
	svc, err := ProvideService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware), loader, prometheus.NewRegistry(), NewGrafanaRouter(nil, nil))
	require.NoError(t, err)
	require.Nil(t, svc.mt)
}

func TestSingleTenantFallbackRefusesForwardedRequests(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
		t.Fatal("a refused request must not reach a stack lookup")
		return singleTenantStack{}, nil
	}
	req := httptest.NewRequest(http.MethodGet, "/apis/remote.grafana.app/v1/namespaces/stacks-1/things", nil)
	req.Header.Set(stFallbackHeader, stFallbackValue)
	recorder := httptest.NewRecorder()
	st.ServeHTTP(recorder, req)
	require.Equal(t, http.StatusNotFound, recorder.Code)
	require.Equal(t, uint64(1), st.fallbackRefused.Load())
}

// Only the stack marks a request. The router's forward to a stack leaves it
// unmarked, so the stack's own fallback to the router still works.
func TestSingleTenantFallbackDoesNotMarkForwardedRequests(t *testing.T) {
	st := newTestSingleTenantFallback(t)
	st.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
		return singleTenantStack{URL: "https://tenant.example.com"}, nil
	}
	st.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
		require.Empty(t, req.Header.Get(stFallbackHeader))
		return &http.Response{StatusCode: http.StatusNoContent, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(""))}, nil
	})
	recorder := httptest.NewRecorder()
	st.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis/remote.grafana.app/v1/namespaces/stacks-1/things", nil))
	require.Equal(t, http.StatusNoContent, recorder.Code)
	require.Zero(t, st.fallbackRefused.Load())
}
