package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/handler3"

	"github.com/grafana/grafana-app-sdk/app"
)

const (
	visibleGroup = "visible.ext.grafana.app"
	hiddenGroup  = "mobile.ext.grafana.app"
	// internalHeader marks a request as internal for the test policy.
	internalHeader = "X-Test-Internal"
)

// restrictedTestBackend serves its group's name, with a manifest and
// resources, and is restricted when restricted is set.
type restrictedTestBackend struct {
	fakeManifestBackend
	restricted bool
}

func (b *restrictedTestBackend) RestrictedGroup() bool { return b.restricted }

func (b *restrictedTestBackend) Discovery() (apidiscoveryv2.APIGroupDiscovery, bool) {
	return apidiscoveryv2.APIGroupDiscovery{
		ObjectMeta: metav1.ObjectMeta{Name: b.group.Name},
		Versions:   []apidiscoveryv2.APIVersionDiscovery{{Version: "v1", Freshness: apidiscoveryv2.DiscoveryFreshnessCurrent}},
	}, true
}

func newRestrictedTestBackend(group string, restricted bool) *restrictedTestBackend {
	return &restrictedTestBackend{
		fakeManifestBackend: fakeManifestBackend{
			fakeBackend: fakeBackend{
				key:   group + "-key",
				group: testAPIGroup(group, "v1"),
				handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					_, _ = w.Write([]byte(group))
				}),
			},
			manifest: &app.ManifestData{AppName: group, Group: group, Versions: []app.ManifestVersion{{Name: "v1", Served: true}}},
		},
		restricted: restricted,
	}
}

// restrictedRouter serves visibleGroup and the restricted hiddenGroup. Its
// policy counts how often it is asked, and finds a request internal when it
// carries internalHeader.
func restrictedRouter(t *testing.T, backends ...Backend) (*GrafanaRouter, *int) {
	t.Helper()
	if backends == nil {
		backends = []Backend{newRestrictedTestBackend(visibleGroup, false), newRestrictedTestBackend(hiddenGroup, true)}
	}
	loader := &statusLoader{
		backends: backends,
		shadowed: []shadowedGroup{
			{Group: hiddenGroup, Source: aggregateSource("other"), By: aggregateSource("baas_apiserver")},
			{Group: visibleGroup, Source: aggregateSource("other"), By: aggregateSource("baas_apiserver")},
		},
	}
	r := NewGrafanaRouter(loader, nil)
	asked := 0
	r.internalCaller = func(req *http.Request) bool {
		asked++
		return req.Header.Get(internalHeader) != ""
	}
	require.NoError(t, r.reconcile(t.Context()))
	return r, &asked
}

func callerRequest(target string, internal bool) *http.Request {
	req := newAuthenticatedRequest(http.MethodGet, target, nil)
	if internal {
		req.Header.Set(internalHeader, "yes")
	}
	return req
}

func serveAs(r *GrafanaRouter, req *http.Request, next http.Handler) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	r.HandleFunc(rec, req, next)
	return rec
}

func TestRestrictedGroupIsServedOnlyToInternalCallers(t *testing.T) {
	r, _ := restrictedRouter(t)
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	for _, path := range []string{
		"/apis/" + hiddenGroup,
		"/apis/" + hiddenGroup + "/v1/namespaces/default/things",
		"/openapi/v3/apis/" + hiddenGroup + "/v1",
	} {
		t.Run(path, func(t *testing.T) {
			req, outcome := withRequestOutcome(callerRequest(path, false))
			rec := serveAs(r, req, next)
			require.Equal(t, http.StatusTeapot, rec.Code, "an external caller is sent where an unknown group goes")
			require.Equal(t, routeHidden, outcome.route)

			req, outcome = withRequestOutcome(callerRequest(path, true))
			rec = serveAs(r, req, next)
			require.Equal(t, http.StatusOK, rec.Code)
			require.Equal(t, hiddenGroup, rec.Body.String())
			require.Equal(t, routeBackend, outcome.route)
		})
	}

	rec := serveAs(r, callerRequest("/apis/"+visibleGroup+"/v1/things", false), next)
	require.Equal(t, visibleGroup, rec.Body.String(), "other groups are served to everyone")
}

func TestRestrictedGroupLooksLikeAnUnknownGroup(t *testing.T) {
	r, _ := restrictedRouter(t)
	r.unregisteredGroupHandler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		http.Error(w, "not found: "+apiGroup(req.URL.Path), http.StatusNotFound)
	})
	unknown := serveAs(r, callerRequest("/apis/unknown.ext.grafana.app/v1/things", false), http.NotFoundHandler())
	hidden := serveAs(r, callerRequest("/apis/"+hiddenGroup+"/v1/things", false), http.NotFoundHandler())
	require.Equal(t, unknown.Code, hidden.Code)
	require.Equal(t, "not found: "+hiddenGroup+"\n", hidden.Body.String())
}

func TestRestrictedGroupWithoutPolicyIsHiddenFromEveryone(t *testing.T) {
	r, _ := restrictedRouter(t)
	r.internalCaller = nil
	rec := serveAs(r, callerRequest("/apis/"+hiddenGroup+"/v1/things", true), http.NotFoundHandler())
	require.Equal(t, http.StatusNotFound, rec.Code)
}

// Every document that lists groups leaves the restricted group out for an
// external caller, lists it for an internal one, and tells shared caches the
// answer depends on the caller.
func TestRestrictedGroupIsLeftOutOfDiscovery(t *testing.T) {
	r, _ := restrictedRouter(t)
	fallback := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		switch {
		case req.URL.Path == openapiV3Prefix:
			_ = json.NewEncoder(w).Encode(handler3.OpenAPIV3Discovery{Paths: map[string]handler3.OpenAPIV3DiscoveryGroupVersion{
				"apis/core.grafana.app/v1": {ServerRelativeURL: "/openapi/v3/apis/core.grafana.app/v1?hash=1"},
			}})
		case req.Header.Get("Accept") == aggregatedDiscoveryJSON:
			_ = json.NewEncoder(w).Encode(apidiscoveryv2.APIGroupDiscoveryList{
				TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"},
				Items:    []apidiscoveryv2.APIGroupDiscovery{{ObjectMeta: metav1.ObjectMeta{Name: "core.grafana.app"}, Versions: []apidiscoveryv2.APIVersionDiscovery{{Version: "v1"}}}},
			})
		default:
			_ = json.NewEncoder(w).Encode(metav1.APIGroupList{
				TypeMeta: metav1.TypeMeta{Kind: "APIGroupList", APIVersion: "v1"},
				Groups:   []metav1.APIGroup{testAPIGroup("core.grafana.app", "v1")},
			})
		}
	})

	for _, tc := range []struct {
		name, path, accept string
		next               http.Handler
	}{
		{name: "group list", path: "/apis", next: http.NotFoundHandler()},
		{name: "merged group list", path: "/apis", next: fallback},
		{name: "aggregated discovery", path: "/apis", accept: aggregatedDiscoveryJSON, next: fallback},
		{name: "openapi index", path: "/openapi/v3", next: http.NotFoundHandler()},
		{name: "merged openapi index", path: "/openapi/v3", next: fallback},
		{name: "manifest list", path: manifestDiscoveryList, next: http.NotFoundHandler()},
		{name: "agents index", path: discoveryAgentsMD, next: http.NotFoundHandler()},
		{name: "agents page", path: discoveryAgentsHTML, next: http.NotFoundHandler()},
	} {
		t.Run(tc.name, func(t *testing.T) {
			serve := func(internal bool) *httptest.ResponseRecorder {
				req := callerRequest(tc.path, internal)
				if tc.accept != "" {
					req.Header.Set("Accept", tc.accept)
				}
				rec := serveAs(r, req, tc.next)
				require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
				require.Equal(t, "private", rec.Header().Get("Cache-Control"))
				require.Contains(t, rec.Body.String(), visibleGroup)
				return rec
			}
			external, internal := serve(false), serve(true)
			require.NotContains(t, external.Body.String(), hiddenGroup)
			require.Contains(t, internal.Body.String(), hiddenGroup)
			require.NotEqual(t, external.Header().Get("ETag"), internal.Header().Get("ETag"))
		})
	}
}

func TestRestrictedGroupManifestIsNotFoundForExternalCallers(t *testing.T) {
	r, _ := restrictedRouter(t)
	path := manifestDiscoveryGroups + hiddenGroup
	require.Equal(t, http.StatusNotFound, serveAs(r, callerRequest(path, false), http.NotFoundHandler()).Code)
	require.Equal(t, http.StatusOK, serveAs(r, callerRequest(path, true), http.NotFoundHandler()).Code)

	list, err := r.ListManifests(t.Context())
	require.NoError(t, err)
	require.Len(t, list.Items, 2, "in-process readers see every group")
	_, err = r.GetManifest(t.Context(), hiddenGroup)
	require.NoError(t, err)
}

func TestRestrictedGroupIsLeftOutOfStatus(t *testing.T) {
	r, _ := restrictedRouter(t)
	read := func(internal bool) (string, []string, []string) {
		rec := serveAs(r, callerRequest(manifestDiscoveryStatus, internal), http.NotFoundHandler())
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
		var doc routerStatusDoc
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &doc))
		groups, shadowed := make([]string, 0, len(doc.Groups)), make([]string, 0, len(doc.Shadowed))
		for _, g := range doc.Groups {
			groups = append(groups, g.Group)
		}
		for _, s := range doc.Shadowed {
			shadowed = append(shadowed, s.Group)
		}
		return rec.Body.String(), groups, shadowed
	}
	body, groups, shadowed := read(false)
	require.NotContains(t, body, hiddenGroup)
	require.Equal(t, []string{visibleGroup}, groups)
	require.Equal(t, []string{visibleGroup}, shadowed)

	_, groups, shadowed = read(true)
	require.ElementsMatch(t, []string{visibleGroup, hiddenGroup}, groups)
	require.ElementsMatch(t, []string{visibleGroup, hiddenGroup}, shadowed)
}

// Without a restricted group, nothing depends on the caller: the policy is
// never asked, both variants are the same documents, and shared caches may
// keep them.
func TestNoRestrictedGroupLeavesDiscoveryShared(t *testing.T) {
	r, asked := restrictedRouter(t, newRestrictedTestBackend(visibleGroup, false))
	require.Same(t, r.apiGroupList.Load(), r.publicAPIGroupList.Load())
	require.Same(t, r.openapiIndex.Load(), r.publicOpenAPIIndex.Load())
	require.Same(t, r.manifestDocs.Load(), r.publicManifestDocs.Load())

	for _, path := range []string{"/apis", "/openapi/v3", manifestDiscoveryList, discoveryAgentsMD, "/apis/" + visibleGroup + "/v1/things", manifestDiscoveryStatus} {
		rec := serveAs(r, callerRequest(path, false), http.NotFoundHandler())
		require.NotEqual(t, "private", rec.Header().Get("Cache-Control"), path)
	}
	aggregated := callerRequest("/apis", false)
	aggregated.Header.Set("Accept", aggregatedDiscoveryJSON)
	require.NotEqual(t, "private", serveAs(r, aggregated, http.NotFoundHandler()).Header().Get("Cache-Control"))
	require.Zero(t, *asked)
}

// The policy is asked at most once per request, however many restricted
// groups a document lists.
func TestRestrictedGroupPolicyIsAskedOncePerRequest(t *testing.T) {
	r, asked := restrictedRouter(t,
		newRestrictedTestBackend(visibleGroup, false),
		newRestrictedTestBackend(hiddenGroup, true),
		newRestrictedTestBackend("other.ext.grafana.app", true))
	serveAs(r, callerRequest("/openapi/v3", false), http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(handler3.OpenAPIV3Discovery{Paths: map[string]handler3.OpenAPIV3DiscoveryGroupVersion{}})
	}))
	require.Equal(t, 1, *asked)
}

func TestPublishSwitchesVariantsWhenAGroupTurnsRestricted(t *testing.T) {
	visible := newRestrictedTestBackend(hiddenGroup, false)
	loader := &mutableLoader{backends: []Backend{visible}}
	r := NewGrafanaRouter(loader, nil)
	require.NoError(t, r.reconcile(t.Context()))
	require.Contains(t, string(r.publicManifestDocs.Load().manifests[hiddenGroup].body), hiddenGroup)

	restricted := newRestrictedTestBackend(hiddenGroup, true)
	restricted.key = visible.key + ":internal"
	loader.backends = []Backend{restricted}
	require.NoError(t, r.reconcile(t.Context()))
	require.NotContains(t, r.publicManifestDocs.Load().manifests, hiddenGroup)
	require.Contains(t, r.manifestDocs.Load().manifests, hiddenGroup)
	require.NotContains(t, string(r.publicAPIGroupList.Load().body), hiddenGroup)
	require.Contains(t, string(r.apiGroupList.Load().body), hiddenGroup)
}
