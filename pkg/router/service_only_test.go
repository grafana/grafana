package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/handler3"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/setting"
)

const serviceOnlyTestGroup = "agenthub.ext.grafana.app"

var (
	testUser    = &identity.StaticRequester{Type: types.TypeUser, UserUID: "u", OrgID: 1, Namespace: "*", IsGrafanaAdmin: true}
	testService = &identity.StaticRequester{Type: types.TypeAccessPolicy, UserUID: "policy", Namespace: "*"}
)

func requestBy(requester identity.Requester, method, target string) *http.Request {
	req := httptest.NewRequest(method, target, nil)
	return req.WithContext(identity.WithRequester(req.Context(), requester))
}

func TestServiceOnlyGroupsFromConfig(t *testing.T) {
	t.Run("defaults.ini", func(t *testing.T) {
		cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{HomePath: "../../"})
		require.NoError(t, err)
		groups, err := serviceOnlyGroupsFromConfig(cfg)
		require.NoError(t, err)
		require.Equal(t, map[string]bool{"events.k8s.io": true, "agenthub.ext.grafana.app": true}, groups)
	})
	t.Run("unset", func(t *testing.T) {
		groups, err := serviceOnlyGroupsFromConfig(setting.NewCfg())
		require.NoError(t, err)
		require.Empty(t, groups)
	})
	t.Run("environment override", func(t *testing.T) {
		t.Setenv("GF_ROUTER_SERVICE_ONLY_GROUPS", "a.grafana.app b.grafana.app")
		groups, err := serviceOnlyGroupsFromConfig(setting.NewCfg())
		require.NoError(t, err)
		require.Equal(t, map[string]bool{"a.grafana.app": true, "b.grafana.app": true}, groups)
	})
	for _, invalid := range []string{"Not_A_Group", discoveryGroup} {
		t.Run("invalid "+invalid, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.Raw.Section(routerSection).Key("service_only_groups").SetValue("ok.grafana.app, " + invalid)
			_, err := serviceOnlyGroupsFromConfig(cfg)
			require.ErrorContains(t, err, invalid)
		})
	}
}

// newServiceOnlyTestRouter serves the manifest test backends plus a
// service-only group with a manifest.
func newServiceOnlyTestRouter(t *testing.T) *GrafanaRouter {
	t.Helper()
	hidden := &fakeManifestBackend{
		fakeBackend: fakeBackend{key: "agenthub-key", group: testAPIGroup(serviceOnlyTestGroup, "v1"), handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		})},
		manifest: &app.ManifestData{AppName: "agenthub", Group: serviceOnlyTestGroup, PreferredVersion: "v1", Versions: []app.ManifestVersion{{Name: "v1", Served: true}}},
	}
	r := NewGrafanaRouter(staticLoader{backends: append(testManifestBackends(), hidden)}, nil)
	r.serviceOnly = map[string]bool{serviceOnlyTestGroup: true, "events.k8s.io": true}
	require.NoError(t, r.reconcile(t.Context()))
	return r
}

func TestServiceOnlyGroupsRefuseOtherRequesters(t *testing.T) {
	r := newServiceOnlyTestRouter(t)
	fallbackCalls := 0
	r.unregisteredGroupHandler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fallbackCalls++
		w.WriteHeader(http.StatusNoContent)
	})
	for _, path := range []string{
		"/apis/" + serviceOnlyTestGroup,
		"/apis/" + serviceOnlyTestGroup + "/v1/namespaces/stacks-1/agents",
		"/apis/" + serviceOnlyTestGroup + "/v1/agents?watch=true",
		"/openapi/v3/apis/" + serviceOnlyTestGroup + "/v1",
		"/apis/events.k8s.io/v1/namespaces/stacks-1/events", // served by the fallback, if anyone
	} {
		t.Run(path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			r.HandleFunc(rec, requestBy(testUser, http.MethodGet, path))
			require.Equal(t, http.StatusForbidden, rec.Code, "even a Grafana admin is not a service")
			var status metav1.Status
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &status))
			require.Equal(t, metav1.StatusReasonForbidden, status.Reason)
			require.Zero(t, fallbackCalls)

			rec = httptest.NewRecorder()
			r.HandleFunc(rec, requestBy(testService, http.MethodGet, path))
			require.NotEqual(t, http.StatusForbidden, rec.Code)
		})
	}
}

func TestServiceOnlyGroupsAreHiddenFromDiscovery(t *testing.T) {
	r := newServiceOnlyTestRouter(t)
	serve := func(requester identity.Requester, path, accept string) *httptest.ResponseRecorder {
		req := requestBy(requester, http.MethodGet, path)
		if accept != "" {
			req.Header.Set("Accept", accept)
		}
		rec := httptest.NewRecorder()
		r.HandleFunc(rec, req)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		require.Equal(t, "private", rec.Header().Get("Cache-Control"), "the answer depends on the caller")
		return rec
	}
	legacyGroups := func(requester identity.Requester) []string {
		var list metav1.APIGroupList
		require.NoError(t, json.Unmarshal(serve(requester, "/apis", "application/json").Body.Bytes(), &list))
		names := make([]string, 0, len(list.Groups))
		for _, g := range list.Groups {
			names = append(names, g.Name)
		}
		return names
	}
	aggregatedGroups := func(requester identity.Requester) []string {
		var list apidiscoveryv2.APIGroupDiscoveryList
		require.NoError(t, json.Unmarshal(serve(requester, "/apis", aggregatedDiscoveryJSON).Body.Bytes(), &list))
		names := make([]string, 0, len(list.Items))
		for _, g := range list.Items {
			names = append(names, g.Name)
		}
		return names
	}
	openAPIPaths := func(requester identity.Requester) map[string]handler3.OpenAPIV3DiscoveryGroupVersion {
		var index handler3.OpenAPIV3Discovery
		require.NoError(t, json.Unmarshal(serve(requester, "/openapi/v3", "").Body.Bytes(), &index))
		return index.Paths
	}
	manifests := func(requester identity.Requester) []string {
		var list appmanifestv1alpha2.AppManifestList
		require.NoError(t, json.Unmarshal(serve(requester, manifestDiscoveryList, "").Body.Bytes(), &list))
		names := make([]string, 0, len(list.Items))
		for _, m := range list.Items {
			names = append(names, m.Name)
		}
		return names
	}

	require.NotContains(t, legacyGroups(testUser), serviceOnlyTestGroup)
	require.Contains(t, legacyGroups(testService), serviceOnlyTestGroup)
	require.NotContains(t, aggregatedGroups(testUser), serviceOnlyTestGroup)
	require.Contains(t, aggregatedGroups(testService), serviceOnlyTestGroup)
	require.NotContains(t, openAPIPaths(testUser), "apis/"+serviceOnlyTestGroup+"/v1")
	require.Contains(t, openAPIPaths(testService), "apis/"+serviceOnlyTestGroup+"/v1")
	require.Equal(t, []string{manifestTestGroup}, manifests(testUser))
	require.Equal(t, []string{serviceOnlyTestGroup, manifestTestGroup}, manifests(testService))
	require.NotContains(t, serve(testUser, discoveryAgentsMD, "").Body.String(), serviceOnlyTestGroup)
	require.Contains(t, serve(testService, discoveryAgentsMD, "").Body.String(), serviceOnlyTestGroup)

	rec := httptest.NewRecorder()
	r.HandleFunc(rec, requestBy(testUser, http.MethodGet, manifestDiscoveryGroups+serviceOnlyTestGroup))
	require.Equal(t, http.StatusNotFound, rec.Code)
	serve(testService, manifestDiscoveryGroups+serviceOnlyTestGroup, "")

	t.Run("in-process readers see every manifest", func(t *testing.T) {
		list, err := r.ListManifests(t.Context())
		require.NoError(t, err)
		require.Len(t, list.Items, 2)
	})

	t.Run("status lists them, marked", func(t *testing.T) {
		rec := httptest.NewRecorder()
		r.HandleFunc(rec, requestBy(testUser, http.MethodGet, manifestDiscoveryStatus))
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
		var doc routerStatusDoc
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &doc))
		marked := map[string]bool{}
		for _, g := range doc.Groups {
			marked[g.Group] = g.ServiceOnly
		}
		require.Equal(t, map[string]bool{serviceOnlyTestGroup: true, manifestTestGroup: false, "gadgets.example.com": false}, marked)
	})
}

// The fallback answers root discovery for the caller's stack, which may list
// a service-only group the router doesn't serve.
func TestServiceOnlyGroupsAreHiddenFromFallbackDiscovery(t *testing.T) {
	r := newServiceOnlyTestRouter(t)
	r.unregisteredGroupHandler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		var body any
		switch {
		case req.URL.Path == openapiV3Prefix:
			body = handler3.OpenAPIV3Discovery{Paths: map[string]handler3.OpenAPIV3DiscoveryGroupVersion{
				"apis/events.k8s.io/v1":     {ServerRelativeURL: "/openapi/v3/apis/events.k8s.io/v1"},
				"apis/stack.grafana.app/v1": {ServerRelativeURL: "/openapi/v3/apis/stack.grafana.app/v1"},
			}}
		case strings.Contains(req.Header.Get("Accept"), "APIGroupDiscoveryList"):
			body = apidiscoveryv2.APIGroupDiscoveryList{
				TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"},
				Items: []apidiscoveryv2.APIGroupDiscovery{
					benchmarkGroupDiscovery("events.k8s.io"),
					benchmarkGroupDiscovery("stack.grafana.app"),
				},
			}
		default:
			body = metav1.APIGroupList{
				TypeMeta: metav1.TypeMeta{Kind: "APIGroupList", APIVersion: "v1"},
				Groups:   []metav1.APIGroup{testAPIGroup("events.k8s.io", "v1"), testAPIGroup("stack.grafana.app", "v1")},
			}
		}
		require.NoError(t, json.NewEncoder(w).Encode(body))
	})
	serve := func(requester identity.Requester, path, accept string) string {
		req := requestBy(requester, http.MethodGet, path)
		if accept != "" {
			req.Header.Set("Accept", accept)
		}
		rec := httptest.NewRecorder()
		r.HandleFunc(rec, req)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		return rec.Body.String()
	}
	for _, tc := range []struct{ path, accept string }{
		{"/apis", "application/json"},
		{"/apis", aggregatedDiscoveryJSON},
		{"/openapi/v3", ""},
	} {
		t.Run(tc.path+" "+tc.accept, func(t *testing.T) {
			user := serve(testUser, tc.path, tc.accept)
			require.Contains(t, user, "stack.grafana.app")
			require.NotContains(t, user, "events.k8s.io")
			require.NotContains(t, user, serviceOnlyTestGroup)

			service := serve(testService, tc.path, tc.accept)
			require.Contains(t, service, "events.k8s.io")
			require.Contains(t, service, serviceOnlyTestGroup)
		})
	}
}

// Without a service-only group served, everyone shares the same documents,
// and root discovery may still be cached publicly.
func TestNoServiceOnlyGroupsServed(t *testing.T) {
	r := NewGrafanaRouter(staticLoader{backends: testManifestBackends()}, nil)
	r.serviceOnly = map[string]bool{serviceOnlyTestGroup: true}
	require.NoError(t, r.reconcile(t.Context()))
	require.Equal(t, r.apiGroupList.Load(), r.userAPIGroupList.Load())
	require.Equal(t, r.openapiIndex.Load(), r.userOpenAPIIndex.Load())
	require.Same(t, r.manifestDocs.Load(), r.userManifestDocs.Load())

	rec := httptest.NewRecorder()
	r.HandleFunc(rec, requestBy(testUser, http.MethodGet, "/apis"))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Empty(t, rec.Header().Get("Cache-Control"))
}
