package router

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/handler3"

	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/setting"
)

// fakeGroupAccess hides the groups in hidden from the requester they're
// keyed by, and fails for failFor.
type fakeGroupAccess struct {
	hidden  map[string]map[string]bool
	failFor string
	calls   int
}

func (f *fakeGroupAccess) HiddenGroups(_ context.Context, requester identity.Requester, plugins map[string]string) (map[string]bool, error) {
	f.calls++
	if requester.GetIdentifier() == f.failFor {
		return nil, errors.New("access check unavailable")
	}
	return f.hidden[requester.GetIdentifier()], nil
}

var (
	restrictedUser = &identity.StaticRequester{Type: types.TypeUser, UserUID: "restricted", OrgID: 1, Namespace: "*"}
	brokenUser     = &identity.StaticRequester{Type: types.TypeUser, UserUID: "broken", OrgID: 1, Namespace: "*"}
)

// newGroupAccessTestRouter serves widgets as the widgets-app plugin, gadgets
// without a plugin, and the service-only group.
func newGroupAccessTestRouter(t *testing.T, access *fakeGroupAccess) *GrafanaRouter {
	t.Helper()
	backends := testManifestBackends()
	widgets := &fakeStatusBackend{
		fakeManifestBackend: *backends[0].(*fakeManifestBackend),
		plugin:              PluginStatus{ID: "widgets-app"},
	}
	widgets.handler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	hidden := &fakeBackend{key: "agenthub-key", group: testAPIGroup(serviceOnlyTestGroup, "v1")}
	r := NewGrafanaRouter(staticLoader{backends: []Backend{widgets, backends[1], hidden}}, nil)
	r.serviceOnly = map[string]bool{serviceOnlyTestGroup: true}
	r.groupAccess = access
	require.NoError(t, r.reconcile(t.Context()))
	return r
}

func TestGroupAccessHidesPluginGroupsFromDiscovery(t *testing.T) {
	access := &fakeGroupAccess{
		hidden:  map[string]map[string]bool{"restricted": {manifestTestGroup: true}},
		failFor: "broken",
	}
	r := newGroupAccessTestRouter(t, access)
	serve := func(requester identity.Requester, path, accept string) *httptest.ResponseRecorder {
		req := requestBy(requester, http.MethodGet, path)
		if accept != "" {
			req.Header.Set("Accept", accept)
		}
		rec := httptest.NewRecorder()
		r.HandleFunc(rec, req)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		require.Equal(t, "private", rec.Header().Get("Cache-Control"))
		return rec
	}
	// visible reports, for each discovery document, whether it lists widgets
	// and gadgets.
	visible := func(requester identity.Requester) map[string][2]bool {
		got := map[string][2]bool{}

		var legacy metav1.APIGroupList
		require.NoError(t, json.Unmarshal(serve(requester, "/apis", "application/json").Body.Bytes(), &legacy))
		names := map[string]bool{}
		for _, g := range legacy.Groups {
			names[g.Name] = true
		}
		got["legacy"] = [2]bool{names[manifestTestGroup], names["gadgets.example.com"]}

		var agg apidiscoveryv2.APIGroupDiscoveryList
		require.NoError(t, json.Unmarshal(serve(requester, "/apis", aggregatedDiscoveryJSON).Body.Bytes(), &agg))
		names = map[string]bool{}
		for _, g := range agg.Items {
			names[g.Name] = true
		}
		got["aggregated"] = [2]bool{names[manifestTestGroup], names["gadgets.example.com"]}

		var index handler3.OpenAPIV3Discovery
		require.NoError(t, json.Unmarshal(serve(requester, "/openapi/v3", "").Body.Bytes(), &index))
		_, w := index.Paths["apis/"+manifestTestGroup+"/v1"]
		_, g := index.Paths["apis/gadgets.example.com/v2"]
		got["openapi"] = [2]bool{w, g}

		var manifests appmanifestv1alpha2.AppManifestList
		require.NoError(t, json.Unmarshal(serve(requester, manifestDiscoveryList, "").Body.Bytes(), &manifests))
		got["manifests"] = [2]bool{len(manifests.Items) == 1, true} // gadgets has no manifest

		md := serve(requester, discoveryAgentsMD, "").Body.String()
		got["index"] = [2]bool{strings.Contains(md, manifestTestGroup), strings.Contains(md, "gadgets.example.com")}
		return got
	}
	all := map[string][2]bool{"legacy": {true, true}, "aggregated": {true, true}, "openapi": {true, true}, "manifests": {true, true}, "index": {true, true}}
	noWidgets := map[string][2]bool{"legacy": {false, true}, "aggregated": {false, true}, "openapi": {false, true}, "manifests": {false, true}, "index": {false, true}}

	require.Equal(t, all, visible(testUser))
	require.Equal(t, noWidgets, visible(restrictedUser))
	require.Equal(t, noWidgets, visible(brokenUser), "a failed check hides the plugin groups")
	require.Equal(t, all, visible(testService))

	t.Run("services skip the check", func(t *testing.T) {
		calls := access.calls
		visible(testService)
		require.Equal(t, calls, access.calls)
	})

	t.Run("an unrestricted user gets the shared documents", func(t *testing.T) {
		rec := serve(testUser, "/apis", "application/json")
		require.Equal(t, r.userAPIGroupList.Load().etag, rec.Header().Get("ETag"))
		require.NotEqual(t, r.userAPIGroupList.Load().etag, serve(restrictedUser, "/apis", "application/json").Header().Get("ETag"))
	})

	t.Run("restricted documents are cached by the groups hidden, until the next publish", func(t *testing.T) {
		require.Equal(t, 1, r.restrictedDocs.Len(), "restricted and broken hide the same group")
		docs := r.restrictedDocsFor(t.Context(), r.groupFilter(requestBy(restrictedUser, http.MethodGet, "/apis")))
		require.Same(t, docs, r.restrictedDocsFor(t.Context(), r.groupFilter(requestBy(restrictedUser, http.MethodGet, "/apis"))))
		r.publish(t.Context())
		require.Zero(t, r.restrictedDocs.Len())
		require.NotSame(t, docs, r.restrictedDocsFor(t.Context(), r.groupFilter(requestBy(restrictedUser, http.MethodGet, "/apis"))))
	})

	t.Run("a hidden manifest is not found", func(t *testing.T) {
		rec := httptest.NewRecorder()
		r.HandleFunc(rec, requestBy(restrictedUser, http.MethodGet, manifestDiscoveryGroups+manifestTestGroup))
		require.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("requests are left to the plugin's backend", func(t *testing.T) {
		rec := httptest.NewRecorder()
		r.HandleFunc(rec, requestBy(restrictedUser, http.MethodGet, "/apis/"+manifestTestGroup+"/v1/widgets"))
		require.Equal(t, http.StatusNoContent, rec.Code)
	})

	t.Run("status lists every group", func(t *testing.T) {
		rec := httptest.NewRecorder()
		r.HandleFunc(rec, requestBy(restrictedUser, http.MethodGet, manifestDiscoveryStatus))
		require.Equal(t, http.StatusOK, rec.Code)
		var doc routerStatusDoc
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &doc))
		require.Len(t, doc.Groups, 3)
	})
}

// permissionsAccessControl evaluates against a fixed set of permissions.
type permissionsAccessControl struct {
	actest.FakeAccessControl
	permissions map[string][]string
}

func (a permissionsAccessControl) Evaluate(_ context.Context, _ identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	return evaluator.Evaluate(a.permissions), nil
}

func TestPluginLoaderHiddenGroups(t *testing.T) {
	plugins := map[string]string{"allowed.ext.grafana.app": "allowed-app", "denied.ext.grafana.app": "denied-app"}
	for _, tc := range []struct {
		name   string
		access accesscontrol.AccessControl
		want   map[string]bool
	}{
		{"one plugin", permissionsAccessControl{permissions: map[string][]string{
			pluginaccesscontrol.ActionAppAccess: {pluginaccesscontrol.ScopeProvider.GetResourceScope("allowed-app")},
		}}, map[string]bool{"denied.ext.grafana.app": true}},
		{"every plugin", permissionsAccessControl{permissions: map[string][]string{
			pluginaccesscontrol.ActionAppAccess: {pluginaccesscontrol.ScopeProvider.GetResourceAllScope()},
		}}, nil},
		{"no permission", permissionsAccessControl{}, map[string]bool{"allowed.ext.grafana.app": true, "denied.ext.grafana.app": true}},
		{"no access control", nil, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			loader := &PluginLoader{deps: PluginLoaderDependencies{PluginDependencies: PluginDependencies{AccessControl: tc.access}}}
			hidden, err := loader.HiddenGroups(t.Context(), testUser, plugins)
			require.NoError(t, err)
			require.Equal(t, tc.want, hidden)
		})
	}

	t.Run("an evaluation error fails the check", func(t *testing.T) {
		loader := &PluginLoader{deps: PluginLoaderDependencies{PluginDependencies: PluginDependencies{
			AccessControl: &actest.FakeAccessControl{ExpectedErr: errors.New("boom")},
		}}}
		_, err := loader.HiddenGroups(t.Context(), testUser, plugins)
		require.Error(t, err)
	})
}

// ProvideService attaches the loader's filter, so the local plugin loader's
// check applies in every mode.
func TestProvideServiceAttachesGroupAccess(t *testing.T) {
	loader := &PluginLoader{}
	router := NewGrafanaRouter(nil, nil)
	_, err := ProvideService(setting.NewCfg(), featuremgmt.WithFeatures(), loader, prometheus.NewRegistry(), router)
	require.NoError(t, err)
	require.Same(t, loader, router.groupAccess)
}

type benchmarkPluginBackend struct {
	fakeBackend
	id string
}

func (b *benchmarkPluginBackend) PluginStatus() (PluginStatus, bool) {
	return PluginStatus{ID: b.id}, true
}

// BenchmarkGroupAccessDiscovery measures root discovery with 100 plugin
// groups: without a filter, for a user who may use every plugin, and for one
// who may use all but one, through the local plugin loader's real check.
func BenchmarkGroupAccessDiscovery(b *testing.B) {
	const groupCount = 100
	backends := make([]Backend, groupCount)
	everyPlugin := make([]string, 0, groupCount)
	for i := range backends {
		id := fmt.Sprintf("app-%d-app", i)
		backends[i] = &benchmarkPluginBackend{fakeBackend: fakeBackend{key: id, group: testAPIGroup(fmt.Sprintf("app-%d.ext.grafana.app", i), "v1")}, id: id}
		everyPlugin = append(everyPlugin, pluginaccesscontrol.ScopeProvider.GetResourceScope(id))
	}
	for _, tc := range []struct {
		name   string
		scopes []string // nil: no filter
	}{
		{"no_filter", nil},
		{"every_plugin", []string{pluginaccesscontrol.ScopeProvider.GetResourceAllScope()}},
		{"all_but_one", everyPlugin[1:]},
	} {
		r := NewGrafanaRouter(staticLoader{backends: backends}, nil)
		if tc.scopes != nil {
			r.groupAccess = &PluginLoader{deps: PluginLoaderDependencies{PluginDependencies: PluginDependencies{
				AccessControl: permissionsAccessControl{permissions: map[string][]string{pluginaccesscontrol.ActionAppAccess: tc.scopes}},
			}}}
		}
		if err := r.reconcile(b.Context()); err != nil {
			b.Fatal(err)
		}
		for _, path := range []string{"/apis", "/openapi/v3"} {
			b.Run(tc.name+path, func(b *testing.B) {
				req := requestBy(testUser, http.MethodGet, path)
				w := &benchmarkResponseWriter{header: make(http.Header)}
				b.ReportAllocs()
				for b.Loop() {
					clear(w.header)
					r.HandleFunc(w, req)
				}
			})
		}
	}
}
