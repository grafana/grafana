package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/handler3"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const (
	sharedTestGroup = "shared.ext.grafana.app"
	stack1TestGroup = "a.stacks-1." + testOwnerGroup
	stack2TestGroup = "b.stacks-2." + testOwnerGroup
)

// fakeNamespacedBackend is a backend whose group belongs to namespace.
type fakeNamespacedBackend struct {
	fakeBackend
	namespace string
}

func (b *fakeNamespacedBackend) Namespace() string { return b.namespace }

// namespacedRouter serves a shared group and one namespaced group in each of
// stacks-1 and stacks-2, each answering aggregated discovery and counting
// its requests.
func namespacedRouter(t *testing.T) (*GrafanaRouter, map[string]*countingDiscoveryBackend) {
	t.Helper()
	handlers := map[string]*countingDiscoveryBackend{}
	backend := func(group string) fakeBackend {
		handlers[group] = &countingDiscoveryBackend{group: group}
		return fakeBackend{key: group + "-key", group: testAPIGroup(group, "v1"), handler: handlers[group]}
	}
	shared := backend(sharedTestGroup)
	router := NewGrafanaRouter(&mutableLoader{backends: []Backend{
		&shared,
		&fakeNamespacedBackend{fakeBackend: backend(stack1TestGroup), namespace: "stacks-1"},
		&fakeNamespacedBackend{fakeBackend: backend(stack2TestGroup), namespace: "stacks-2"},
	}}, nil)
	require.NoError(t, router.reconcile(t.Context()))
	return router, handlers
}

func namespacedRequest(method, target, namespace string) *http.Request {
	req := httptest.NewRequest(method, target, nil)
	return req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{
		Type: types.TypeUser, UserUID: "u", Namespace: namespace,
	}))
}

// namespacedCallers are the groups listed to each caller namespace. Wildcard
// callers may use every namespace's groups, but none are listed to them.
var namespacedCallers = map[string][]string{
	"stacks-1": {stack1TestGroup, discoveryGroup, sharedTestGroup},
	"stacks-2": {stack2TestGroup, discoveryGroup, sharedTestGroup},
	"*":        {discoveryGroup, sharedTestGroup},
	"stacks-3": {discoveryGroup, sharedTestGroup},
}

func TestRootDiscoveryIsFilteredByNamespace(t *testing.T) {
	// Each next either fails, so the router answers from its snapshot, or
	// lists an embedded group and a copy of a namespaced group, which the
	// router owns and so never serves from next.
	failing := http.NotFoundHandler()
	answering := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		groups := []string{"embedded.grafana.app", stack2TestGroup}
		switch {
		case req.URL.Path == openapiV3Prefix:
			paths := map[string]handler3.OpenAPIV3DiscoveryGroupVersion{}
			for _, g := range groups {
				paths["apis/"+g+"/v1"] = handler3.OpenAPIV3DiscoveryGroupVersion{ServerRelativeURL: "/openapi/v3/apis/" + g + "/v1"}
			}
			_ = json.NewEncoder(w).Encode(handler3.OpenAPIV3Discovery{Paths: paths})
		case req.Header.Get("Accept") == aggregatedDiscoveryJSON:
			list := apidiscoveryv2.APIGroupDiscoveryList{TypeMeta: metav1.TypeMeta{Kind: "APIGroupDiscoveryList", APIVersion: "apidiscovery.k8s.io/v2"}}
			for _, g := range groups {
				list.Items = append(list.Items, thingsDiscovery(g))
			}
			_ = json.NewEncoder(w).Encode(list)
		default:
			list := metav1.APIGroupList{TypeMeta: metav1.TypeMeta{Kind: "APIGroupList", APIVersion: "v1"}}
			for _, g := range groups {
				list.Groups = append(list.Groups, testAPIGroup(g, "v1"))
			}
			_ = json.NewEncoder(w).Encode(list)
		}
	})

	for _, tc := range []struct {
		name  string
		next  http.Handler
		extra []string
	}{
		{name: "failing next", next: failing},
		{name: "answering next", next: answering, extra: []string{"embedded.grafana.app"}},
	} {
		next := tc.next
		t.Run(tc.name, func(t *testing.T) {
			router, _ := namespacedRouter(t)
			for namespace, want := range namespacedCallers {
				want = slices.Sorted(slices.Values(append(slices.Clone(tc.extra), want...)))
				t.Run(namespace, func(t *testing.T) {
					serve := func(target, accept string) *httptest.ResponseRecorder {
						req := namespacedRequest(http.MethodGet, target, namespace)
						req.Header.Set("Accept", accept)
						res := httptest.NewRecorder()
						router.HandleFunc(res, req, next)
						require.Equal(t, http.StatusOK, res.Code, res.Body.String())
						require.Equal(t, "private", res.Header().Get("Cache-Control"), "the documents differ by namespace")
						return res
					}

					var list metav1.APIGroupList
					require.NoError(t, json.Unmarshal(serve("/apis", "application/json").Body.Bytes(), &list))
					var names []string
					for _, g := range list.Groups {
						names = append(names, g.Name)
					}
					require.Equal(t, want, names)

					var aggregated apidiscoveryv2.APIGroupDiscoveryList
					require.NoError(t, json.Unmarshal(serve("/apis", aggregatedDiscoveryJSON).Body.Bytes(), &aggregated))
					names = nil
					for _, g := range aggregated.Items {
						names = append(names, g.Name)
					}
					slices.Sort(names)
					require.Equal(t, want, names)

					var index handler3.OpenAPIV3Discovery
					require.NoError(t, json.Unmarshal(serve(openapiV3Prefix, "application/json").Body.Bytes(), &index))
					names = nil
					for path := range index.Paths {
						group, _, _ := parseOpenAPIGroupVersionPath(openapiV3Prefix + "/" + path)
						names = append(names, group)
					}
					slices.Sort(names)
					require.Equal(t, want, names)
				})
			}
		})
	}
}

func TestRootDiscoveryWithoutNamespacedGroupsIsPublished(t *testing.T) {
	router, _ := namespacedRouter(t)
	for target, doc := range map[string]*cachedDoc{"/apis": router.apiGroupList.Load(), openapiV3Prefix: router.openapiIndex.Load()} {
		res := httptest.NewRecorder()
		router.HandleFunc(res, namespacedRequest(http.MethodGet, target, "stacks-3"), http.NotFoundHandler())
		require.Equal(t, http.StatusOK, res.Code)
		require.Equal(t, string(doc.body), res.Body.String(), "a caller who sees no namespaced group gets the published document")
	}

	shared := discoveryRouter(t, sharedTestGroup, http.NotFoundHandler())
	res := httptest.NewRecorder()
	shared.HandleFunc(res, newAuthenticatedRequest(http.MethodGet, "/apis", nil), http.NotFoundHandler())
	require.Empty(t, res.Header().Get("Cache-Control"), "without namespaced groups, discovery is the same for every caller")
}

func TestAggregatedDiscoveryFetchesOnlyVisibleGroups(t *testing.T) {
	router, handlers := namespacedRouter(t)
	for range 2 {
		req := namespacedRequest(http.MethodGet, "/apis", "stacks-1")
		req.Header.Set("Accept", aggregatedDiscoveryJSON)
		router.HandleFunc(httptest.NewRecorder(), req, http.NotFoundHandler())
	}
	require.Equal(t, int32(1), handlers[stack1TestGroup].calls.Load(), "fetched once, then cached")
	require.Equal(t, int32(1), handlers[sharedTestGroup].calls.Load())
	require.Zero(t, handlers[stack2TestGroup].calls.Load(), "another namespace's group is never fetched")
	_, found, _ := router.discoveryCache.lookup(stack2TestGroup, stack2TestGroup+"-key")
	require.False(t, found)

	// Nor is it fetched for a wildcard caller, to whom no namespace's
	// groups are listed.
	req := namespacedRequest(http.MethodGet, "/apis", "*")
	req.Header.Set("Accept", aggregatedDiscoveryJSON)
	router.HandleFunc(httptest.NewRecorder(), req, http.NotFoundHandler())
	require.Equal(t, int32(1), handlers[stack1TestGroup].calls.Load())
	require.Zero(t, handlers[stack2TestGroup].calls.Load())

	// A caller with no namespace sees no namespaced group.
	req = httptest.NewRequest(http.MethodGet, "/apis", nil)
	req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{Type: types.TypeAnonymous}))
	req.Header.Set("Accept", aggregatedDiscoveryJSON)
	res := httptest.NewRecorder()
	router.HandleFunc(res, req, http.NotFoundHandler())
	var list apidiscoveryv2.APIGroupDiscoveryList
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &list))
	require.Len(t, list.Items, 2)
	require.Zero(t, handlers[stack2TestGroup].calls.Load())
}

// fakeNamespacedManifestBackend is a namespaced backend with a manifest.
type fakeNamespacedManifestBackend struct {
	fakeManifestBackend
	namespace string
}

func (b *fakeNamespacedManifestBackend) Namespace() string { return b.namespace }

func namespacedManifestBackend(group, namespace string) Backend {
	backend := fakeManifestBackend{
		fakeBackend: fakeBackend{key: group + "-key", group: testAPIGroup(group, "v1")},
		manifest:    &app.ManifestData{AppName: group, Group: group, PreferredVersion: "v1", Versions: []app.ManifestVersion{{Name: "v1", Served: true}}},
	}
	if namespace == "" {
		return &backend
	}
	return &fakeNamespacedManifestBackend{fakeManifestBackend: backend, namespace: namespace}
}

func TestManifestDiscoveryIsFilteredByNamespace(t *testing.T) {
	router := NewGrafanaRouter(&mutableLoader{backends: []Backend{
		namespacedManifestBackend(sharedTestGroup, ""),
		namespacedManifestBackend("z.ext.grafana.app", ""),
		namespacedManifestBackend(stack1TestGroup, "stacks-1"),
		namespacedManifestBackend(stack2TestGroup, "stacks-2"),
	}}, nil)
	require.NoError(t, router.reconcile(t.Context()))

	for namespace, sees := range namespacedCallers {
		t.Run(namespace, func(t *testing.T) {
			var want []string
			for _, group := range sees {
				if group != discoveryGroup {
					want = append(want, group)
				}
			}
			want = slices.Sorted(slices.Values(append(want, "z.ext.grafana.app")))
			serve := func(target string) *httptest.ResponseRecorder {
				res := httptest.NewRecorder()
				router.HandleFunc(res, namespacedRequest(http.MethodGet, target, namespace), http.NotFoundHandler())
				return res
			}

			res := serve(manifestDiscoveryList)
			require.Equal(t, http.StatusOK, res.Code, res.Body.String())
			require.Equal(t, "private", res.Header().Get("Cache-Control"))
			require.Equal(t, strconv.Itoa(res.Body.Len()), res.Header().Get("Content-Length"))
			var list struct {
				Items []struct {
					Metadata metav1.ObjectMeta `json:"metadata"`
				} `json:"items"`
			}
			require.NoError(t, json.Unmarshal(res.Body.Bytes(), &list))
			var names []string
			for _, item := range list.Items {
				names = append(names, item.Metadata.Name)
			}
			require.Equal(t, want, names, "in group order")

			index := serve(discoveryAgentsMD).Body.String()
			page := serve(discoveryAgentsHTML).Body.String()
			for _, group := range []string{stack1TestGroup, stack2TestGroup} {
				// A wildcard caller may get each group's manifest, which isn't
				// listed to it.
				if res := serve(manifestDiscoveryGroups + group); slices.Contains(want, group) || namespace == "*" {
					require.Equal(t, http.StatusOK, res.Code)
				} else {
					require.Equal(t, http.StatusNotFound, res.Code)
				}
				if slices.Contains(want, group) {
					require.Contains(t, index, group)
					require.Contains(t, page, group)
				} else {
					require.NotContains(t, index, group)
					require.NotContains(t, page, group)
				}
			}

			res = serve(manifestDiscoveryStatus)
			var status routerStatusDoc
			require.NoError(t, json.Unmarshal(res.Body.Bytes(), &status))
			names = nil
			for _, g := range status.Groups {
				names = append(names, g.Group)
			}
			require.Equal(t, want, names)
		})
	}
}

func TestManifestListETagDiffersByNamespace(t *testing.T) {
	router := NewGrafanaRouter(&mutableLoader{backends: []Backend{
		namespacedManifestBackend(sharedTestGroup, ""),
		namespacedManifestBackend(stack1TestGroup, "stacks-1"),
		namespacedManifestBackend(stack2TestGroup, "stacks-2"),
	}}, nil)
	require.NoError(t, router.reconcile(t.Context()))
	etags := map[string]string{}
	etag := func(namespace string) string {
		res := httptest.NewRecorder()
		router.HandleFunc(res, namespacedRequest(http.MethodGet, manifestDiscoveryList, namespace), http.NotFoundHandler())
		return res.Header().Get("ETag")
	}
	for _, namespace := range []string{"stacks-1", "stacks-2", "stacks-3"} {
		require.NotContains(t, etags, etag(namespace))
		etags[etag(namespace)] = namespace
	}
	published := router.manifestDocs.Load().listETag
	require.Equal(t, published, etag("stacks-3"), "a caller with no namespaced group listed gets the published list")
	require.Equal(t, published, etag("*"))
}

// shadowingLoader reports one shadowed group.
type shadowingLoader struct {
	mutableLoader
	shadowed []shadowedGroup
}

func (l *shadowingLoader) sourceStatuses() []sourceStatus         { return nil }
func (l *shadowingLoader) shadowedGroups() []shadowedGroup        { return l.shadowed }
func (l *shadowingLoader) stackLookups() map[string]uint64        { return nil }
func (l *shadowingLoader) stackDiscoveryCache() map[string]uint64 { return nil }

func TestStatusHidesShadowedNamespacedGroups(t *testing.T) {
	loader := &shadowingLoader{
		mutableLoader: mutableLoader{backends: []Backend{namespacedManifestBackend(stack1TestGroup, "stacks-1")}},
		shadowed:      []shadowedGroup{{Group: stack1TestGroup, Source: "single-tenant", By: namespacedSource(testOwnerGroup)}},
	}
	router := NewGrafanaRouter(loader, nil)
	require.NoError(t, router.reconcile(t.Context()))
	for namespace, want := range map[string]int{"stacks-1": 1, "stacks-2": 0, "*": 0} {
		status := router.routerStatus(namespacedRequest(http.MethodGet, manifestDiscoveryStatus, namespace))
		require.Len(t, status.Shadowed, want, namespace)
	}
}

// A namespaced group shadowed by a real group is listed only to its namespace
// too, though the group served is not namespaced.
func TestStatusHidesNamespacedGroupsShadowedByARealGroup(t *testing.T) {
	loader := &shadowingLoader{
		mutableLoader: mutableLoader{backends: []Backend{namespacedManifestBackend(stack1TestGroup, "")}},
		shadowed:      []shadowedGroup{{Group: stack1TestGroup, Source: namespacedSource(testOwnerGroup), By: "aggregate:a", Namespace: "stacks-1"}},
	}
	router := NewGrafanaRouter(loader, nil)
	require.NoError(t, router.reconcile(t.Context()))
	for namespace, want := range map[string]int{"stacks-1": 1, "stacks-2": 0, "*": 0} {
		status := router.routerStatus(namespacedRequest(http.MethodGet, manifestDiscoveryStatus, namespace))
		require.Len(t, status.Shadowed, want, namespace)
		require.Len(t, status.Groups, 1, "the real group is listed to every caller")
	}
}

func TestNamespacedGroupsAreUnknownToOtherNamespaces(t *testing.T) {
	served := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	router := NewGrafanaRouter(&mutableLoader{backends: []Backend{
		&fakeNamespacedBackend{fakeBackend: fakeBackend{key: "k", group: testAPIGroup(stack1TestGroup, "v1"), handler: served}, namespace: "stacks-1"},
	}}, nil)
	require.NoError(t, router.reconcile(t.Context()))
	// A cached document must not answer another namespace either.
	router.openapiDocs.Store(stack1TestGroup+"/v1", openapiCacheEntry{key: "k", etag: `"e"`, body: []byte("{}"), header: http.Header{}})

	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte("not served here"))
	})
	serve := func(target, namespace string) *httptest.ResponseRecorder {
		res := httptest.NewRecorder()
		router.HandleFunc(res, namespacedRequest(http.MethodGet, target, namespace), next)
		return res
	}
	for _, target := range []string{
		"/apis/" + stack1TestGroup + "/v1/namespaces/stacks-1/things",
		"/apis/" + stack1TestGroup,
		"/apis/" + stack1TestGroup + "/v1",
		"/openapi/v3/apis/" + stack1TestGroup + "/v1",
	} {
		t.Run(target, func(t *testing.T) {
			require.Equal(t, http.StatusOK, serve(target, "stacks-1").Code)
			require.Equal(t, http.StatusOK, serve(target, "*").Code)

			unknown := serve(strings.Replace(target, stack1TestGroup, "unknown.stacks-1."+testOwnerGroup, 1), "stacks-2")
			for _, namespace := range []string{"stacks-2", ""} {
				res := serve(target, namespace)
				require.Equal(t, unknown.Code, res.Code)
				require.Equal(t, unknown.Body.String(), res.Body.String())
				require.Equal(t, unknown.Header(), res.Header())
			}
		})
	}
}
