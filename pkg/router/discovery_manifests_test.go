package router

import (
	"encoding/json"
	"maps"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/openapi3"
	"k8s.io/client-go/rest"
	"k8s.io/kube-openapi/pkg/handler3"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
)

const manifestTestGroup = "widgets.ext.grafana.app"

type fakeManifestBackend struct {
	fakeBackend
	manifest *app.ManifestData
}

func (b *fakeManifestBackend) Manifest() (*app.ManifestData, bool) { return b.manifest, true }

type fakeDiscoveryBackend struct {
	fakeBackend
	discovery apidiscoveryv2.APIGroupDiscovery
}

func (b *fakeDiscoveryBackend) Discovery() (apidiscoveryv2.APIGroupDiscovery, bool) {
	return b.discovery, true
}

func testAPIGroup(name string, versions ...string) metav1.APIGroup {
	group := metav1.APIGroup{Name: name}
	for _, v := range versions {
		group.Versions = append(group.Versions, metav1.GroupVersionForDiscovery{GroupVersion: name + "/" + v, Version: v})
	}
	group.PreferredVersion = group.Versions[0]
	return group
}

func testManifestBackends() []Backend {
	widgets := &fakeManifestBackend{
		fakeBackend: fakeBackend{key: "widgets-key", group: testAPIGroup(manifestTestGroup, "v1")},
		manifest: &app.ManifestData{
			AppName:          "widgets",
			AppDisplayName:   "Widgets",
			Group:            manifestTestGroup,
			PreferredVersion: "v1",
			Operator:         &app.ManifestOperatorInfo{URL: "https://operator.internal"},
			ExtraPermissions: &app.Permissions{},
			Versions: []app.ManifestVersion{{
				Name:   "v1",
				Served: true,
				Kinds:  []app.ManifestVersionKind{{Kind: "Widget", Plural: "widgets", Scope: "Namespaced"}},
				OpenAPI: app.ManifestVersionOpenAPI{Paths: map[string]spec3.PathProps{
					"/namespaces/{namespace}/stats": {Get: &spec3.Operation{OperationProps: spec3.OperationProps{
						Summary: "Widget stats | totals\nper namespace",
					}}},
				}},
			}},
		},
	}
	gadgets := &fakeDiscoveryBackend{
		fakeBackend: fakeBackend{key: "gadgets-key", group: testAPIGroup("gadgets.example.com", "v2")},
		discovery: apidiscoveryv2.APIGroupDiscovery{
			ObjectMeta: metav1.ObjectMeta{Name: "gadgets.example.com"},
			Versions: []apidiscoveryv2.APIVersionDiscovery{{
				Version: "v2",
				Resources: []apidiscoveryv2.APIResourceDiscovery{{
					Resource: "gadgets", Scope: apidiscoveryv2.ScopeCluster, ResponseKind: &metav1.GroupVersionKind{Kind: "Gadget"},
				}},
			}},
		},
	}
	return []Backend{widgets, gadgets}
}

func TestBuildManifestDocs(t *testing.T) {
	docs := buildManifestDocs(t.Context(), testManifestBackends())

	var list appmanifestv1alpha2.AppManifestList
	require.NoError(t, json.Unmarshal(docs.list.body, &list))
	require.Equal(t, "AppManifestList", list.Kind)
	require.Equal(t, appmanifestv1alpha2.GroupVersion.String(), list.APIVersion)
	require.Len(t, list.Items, 1, "only backends with a manifest are listed")

	require.Contains(t, docs.manifests, manifestTestGroup)
	require.NotContains(t, docs.manifests, "gadgets.example.com")
	var manifest appmanifestv1alpha2.AppManifest
	require.NoError(t, json.Unmarshal(docs.manifests[manifestTestGroup].body, &manifest))
	require.Equal(t, list.Items[0], manifest, "the group document is the list item")
	require.Equal(t, "AppManifest", manifest.Kind)
	require.Equal(t, manifestTestGroup, manifest.Name, "named by group")
	require.Equal(t, "widgets", manifest.Spec.AppName)
	require.Equal(t, manifestTestGroup, manifest.Spec.Group)
	require.Len(t, manifest.Spec.Versions, 1)
	require.Equal(t, "Widget", manifest.Spec.Versions[0].Kinds[0].Kind)
	require.Nil(t, manifest.Spec.Operator, "deployment details are not published")
	require.Nil(t, manifest.Spec.ExtraPermissions, "the backend's own permissions are not published")

	index := string(docs.index.body)
	require.Equal(t, "text/markdown; charset=utf-8", docs.index.contentType)
	require.Contains(t, index, "| `"+manifestTestGroup+"` | Widgets | v1 | v1 |")
	require.Contains(t, index, "## Widgets (`"+manifestTestGroup+"`)")
	require.Contains(t, index, "Manifest: [`/apis/discovery/v1alpha2/manifests/"+manifestTestGroup+"`](/apis/discovery/v1alpha2/manifests/"+manifestTestGroup+")")
	require.Contains(t, index, "| Widget | `widgets` | Namespaced |")
	require.Contains(t, index, "- `GET /apis/"+manifestTestGroup+"/v1/namespaces/{namespace}/stats`: Widget stats \\| totals per namespace\n",
		"manifest text stays on one line and cannot break a table")
	require.Contains(t, index, "OpenAPI: `/openapi/v3/apis/"+manifestTestGroup+"/v1?hash=widgets-key`")

	require.Contains(t, index, "## `gadgets.example.com`")
	require.Contains(t, index, "No app manifest is published for this group")
	require.Contains(t, index, "| Gadget | `gadgets` | Cluster |", "provided discovery fills in a group without a manifest")
}

func TestServeManifestDiscovery(t *testing.T) {
	r := NewGrafanaRouter(stubLoader{}, nil)
	for _, b := range testManifestBackends() {
		r.served[b.Group().Name] = &handlerEntry{backend: b, handler: http.NotFoundHandler(), lastKey: b.Key(), breaker: newGroupBreaker(b.Group().Name)}
	}
	r.publish(t.Context())
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	serve := func(req *http.Request) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		r.HandleFunc(rec, req, next)
		return rec
	}

	cases := []struct {
		path        string
		wantCode    int
		contentType string
	}{
		{"/apis/discovery", http.StatusOK, "application/json"},
		{"/apis/discovery/v1alpha2", http.StatusOK, "application/json"},
		{"/apis/discovery/v1alpha2/", http.StatusOK, "application/json"},
		{"/apis/discovery/v1alpha2/index.md", http.StatusOK, "text/markdown; charset=utf-8"},
		{"/apis/discovery/v1alpha2/index.html", http.StatusOK, "text/html; charset=utf-8"},
		{"/apis/discovery/v1alpha2/manifests/" + manifestTestGroup, http.StatusOK, "application/json"},
		{"/apis/discovery/v1alpha2/manifests/gadgets.example.com", http.StatusNotFound, ""},
		{"/apis/discovery/v1alpha2/manifests", http.StatusOK, "application/json"},
		{"/apis/discovery/v1alpha2/manifests/", http.StatusOK, "application/json"},
		{"/apis/discovery/v9", http.StatusNotFound, ""},
		{"/apis/discovery/v1alpha2/manifests/" + manifestTestGroup + "/status", http.StatusNotFound, ""},
	}
	for _, tc := range cases {
		t.Run(tc.path, func(t *testing.T) {
			rec := serve(newAuthenticatedRequest(http.MethodGet, tc.path, nil))
			require.Equal(t, tc.wantCode, rec.Code, rec.Body.String())
			if tc.contentType == "" {
				return
			}
			require.Equal(t, tc.contentType, rec.Header().Get("Content-Type"))

			etag := rec.Header().Get("ETag")
			require.NotEmpty(t, etag)
			conditional := newAuthenticatedRequest(http.MethodGet, tc.path, nil)
			conditional.Header.Set("If-None-Match", etag)
			rec = serve(conditional)
			require.Equal(t, http.StatusNotModified, rec.Code)
			require.Empty(t, rec.Body.String())
		})
	}

	t.Run("documents", func(t *testing.T) {
		var list appmanifestv1alpha2.AppManifestList
		rec := serve(newAuthenticatedRequest(http.MethodGet, "/apis/discovery/v1alpha2/manifests", nil))
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
		require.Equal(t, "AppManifestList", list.Kind)
		require.Len(t, list.Items, 1)
		require.Equal(t, manifestTestGroup, list.Items[0].Spec.Group)

		var group metav1.APIGroup
		rec = serve(newAuthenticatedRequest(http.MethodGet, "/apis/discovery", nil))
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &group))
		require.Equal(t, "APIGroup", group.Kind)
		require.Equal(t, discoveryAPIGroup.PreferredVersion, group.PreferredVersion)
	})

	t.Run("errors are Kubernetes statuses", func(t *testing.T) {
		rec := serve(newAuthenticatedRequest(http.MethodGet, "/apis/discovery/v1alpha2/manifests/missing.ext.grafana.app", nil))
		var status metav1.Status
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &status))
		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Equal(t, metav1.StatusReasonNotFound, status.Reason)
		require.Equal(t, "missing.ext.grafana.app", status.Details.Name)

		rec = serve(newAuthenticatedRequest(http.MethodGet, "/apis/discovery/v1alpha2/manifests?watch=true", nil))
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &status))
		require.Equal(t, http.StatusMethodNotAllowed, rec.Code)
		require.Equal(t, metav1.StatusReasonMethodNotAllowed, status.Reason)
	})

	t.Run("read-only", func(t *testing.T) {
		rec := serve(newAuthenticatedRequest(http.MethodPost, "/apis/discovery/v1alpha2", strings.NewReader("{}")))
		require.Equal(t, http.StatusMethodNotAllowed, rec.Code)
		require.Equal(t, "GET, HEAD", rec.Header().Get("Allow"))
	})

	t.Run("requires authentication", func(t *testing.T) {
		rec := serve(httptest.NewRequest(http.MethodGet, "/apis/discovery/v1alpha2", nil))
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("not a group", func(t *testing.T) {
		require.True(t, r.owns(httptest.NewRequest(http.MethodGet, "/apis/discovery/v1alpha2/index.md", nil)))
		require.False(t, r.owns(httptest.NewRequest(http.MethodGet, "/apis/discoveryx", nil)))
		require.Empty(t, requestGroup("/apis/discovery/v1alpha2"), "no group metric label")
		rec := serve(newAuthenticatedRequest(http.MethodGet, "/apis/discoveryx/v1", nil))
		require.Equal(t, http.StatusTeapot, rec.Code, "only the exact segment is the discovery tree")
	})

	t.Run("html page cannot run anything", func(t *testing.T) {
		rec := serve(newAuthenticatedRequest(http.MethodGet, "/apis/discovery/v1alpha2/index.html", nil))
		require.Equal(t, "default-src 'none'; style-src 'unsafe-inline'", rec.Header().Get("Content-Security-Policy"))
		require.Equal(t, "nosniff", rec.Header().Get("X-Content-Type-Options"))
	})
}

// TestDiscoveryGroupWithKubernetesClients checks that client-go finds the
// discovery group like any other, in both discovery formats, and that its
// dynamic client can list and get the manifests.
func TestDiscoveryGroupWithKubernetesClients(t *testing.T) {
	r := NewGrafanaRouter(stubLoader{}, nil)
	for _, b := range testManifestBackends() {
		r.served[b.Group().Name] = &handlerEntry{backend: b, handler: http.NotFoundHandler(), lastKey: b.Key(), breaker: newGroupBreaker(b.Group().Name)}
	}
	r.publish(t.Context())
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		r.HandleFunc(w, req.WithContext(authenticatedTestContext(req.Context())), http.NotFoundHandler())
	}))
	t.Cleanup(srv.Close)
	cfg := &rest.Config{Host: srv.URL}

	for _, legacy := range []bool{false, true} {
		client, err := discovery.NewDiscoveryClientForConfig(cfg)
		require.NoError(t, err)
		client.UseLegacyDiscovery = legacy
		resources, err := client.ServerResourcesForGroupVersion("discovery/v1alpha2")
		require.NoError(t, err, "legacy=%v", legacy)
		require.Len(t, resources.APIResources, 1)
		manifests := resources.APIResources[0]
		require.Equal(t, "manifests", manifests.Name, "legacy=%v", legacy)
		require.Equal(t, "AppManifest", manifests.Kind)
		require.False(t, manifests.Namespaced)
		require.ElementsMatch(t, []string{"get", "list"}, manifests.Verbs)

		groups, err := client.ServerGroups()
		require.NoError(t, err)
		require.True(t, slices.ContainsFunc(groups.Groups, func(g metav1.APIGroup) bool { return g.Name == discoveryGroup }), "legacy=%v", legacy)
	}

	// kubectl explain reads the group version's OpenAPI document and finds
	// the schema by the kind discovery reports.
	discoveryClient, err := discovery.NewDiscoveryClientForConfig(cfg)
	require.NoError(t, err)
	doc, err := openapi3.NewRoot(discoveryClient.OpenAPIV3()).GVSpec(schema.GroupVersion{Group: discoveryGroup, Version: manifestDiscoveryVersion})
	require.NoError(t, err)
	require.Contains(t, doc.Paths.Paths, "/apis/discovery/v1alpha2/manifests")
	require.Contains(t, doc.Paths.Paths, "/apis/discovery/v1alpha2/manifests/{name}")
	require.Contains(t, doc.Paths.Paths, "/apis/discovery/v1alpha2/status")
	found := ""
	for name, s := range doc.Components.Schemas {
		gvks, _ := s.Extensions["x-kubernetes-group-version-kind"].([]any)
		for _, gvk := range gvks {
			if m := gvk.(map[string]any); m["group"] == discoveryGroup && m["version"] == manifestDiscoveryVersion && m["kind"] == "AppManifest" {
				found = name
			}
		}
	}
	require.Equal(t, "AppManifest", found)

	dynamicClient, err := dynamic.NewForConfig(cfg)
	require.NoError(t, err)
	gvr := schema.GroupVersionResource{Group: discoveryGroup, Version: manifestDiscoveryVersion, Resource: "manifests"}
	list, err := dynamicClient.Resource(gvr).List(t.Context(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Len(t, list.Items, 1)
	require.Equal(t, manifestTestGroup, list.Items[0].GetName())
	obj, err := dynamicClient.Resource(gvr).Get(t.Context(), manifestTestGroup, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, "AppManifest", obj.GetKind())
	require.Equal(t, appmanifestv1alpha2.GroupVersion.String(), obj.GetAPIVersion())
}

func TestDiscoveryOpenAPI(t *testing.T) {
	var doc spec3.OpenAPI
	require.NoError(t, json.Unmarshal(discoveryOpenAPIDoc.body, &doc))
	schemas := doc.Components.Schemas
	require.Contains(t, schemas["spec"].Properties, "appName", "the app-sdk's AppManifest spec schema is used")
	require.Contains(t, schemas["spec"].Properties, "versions")
	manifest := schemas["AppManifest"]
	require.ElementsMatch(t, []string{"apiVersion", "kind", "metadata", "spec"}, slices.Collect(maps.Keys(manifest.Properties)))
	specRef := manifest.Properties["spec"].Ref
	require.Equal(t, "#/components/schemas/spec", specRef.String())
	require.NotContains(t, schemas, "status", "the objects carry no status")
	itemRef := schemas["AppManifestList"].Properties["items"].Items.Schema.Ref
	require.Equal(t, "#/components/schemas/AppManifest", itemRef.String())

	r := NewGrafanaRouter(stubLoader{}, nil)
	serve := func(method, path string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		r.HandleFunc(rec, newAuthenticatedRequest(method, path, nil), http.NotFoundHandler())
		return rec
	}
	rec := serve(http.MethodGet, "/openapi/v3/apis/discovery/v1alpha2?hash=anything")
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, discoveryOpenAPIDoc.etag, rec.Header().Get("ETag"))
	require.Equal(t, http.StatusNotFound, serve(http.MethodGet, "/openapi/v3/apis/discovery/v9").Code)
	require.Equal(t, http.StatusMethodNotAllowed, serve(http.MethodPost, "/openapi/v3/apis/discovery/v1alpha2").Code)
	require.True(t, r.owns(httptest.NewRequest(http.MethodGet, "/openapi/v3/apis/discovery/v1alpha2", nil)))
	require.Empty(t, requestGroup("/openapi/v3/apis/discovery/v1alpha2"), "no group metric label")

	var index handler3.OpenAPIV3Discovery
	require.NoError(t, json.Unmarshal(serve(http.MethodGet, "/openapi/v3").Body.Bytes(), &index))
	_, url := discoveryOpenAPIEntry()
	require.Equal(t, url, index.Paths[discoveryOpenAPIPath].ServerRelativeURL)
}

func TestBuildDiscoveryOpenAPIWithoutSchemas(t *testing.T) {
	body, err := json.Marshal(buildDiscoveryOpenAPI(nil))
	require.NoError(t, err)
	var doc spec3.OpenAPI
	require.NoError(t, json.Unmarshal(body, &doc))
	require.Contains(t, doc.Components.Schemas, "AppManifest")
	require.Contains(t, doc.Components.Schemas, "spec", "the reference stays resolvable")
}

// TestReconcileSkipsTheReservedDiscoveryGroup checks that no source can
// install a backend for the discovery group, which the router serves itself,
// even one whose source did not drop it.
func TestReconcileSkipsTheReservedDiscoveryGroup(t *testing.T) {
	claim := &fakeBackend{key: "claim", group: testAPIGroup(discoveryGroup, "v1")}
	other := &fakeBackend{key: "other", group: testAPIGroup(manifestTestGroup, "v1")}
	r := NewGrafanaRouter(staticLoader{backends: []Backend{claim, other}}, nil)
	require.NoError(t, r.reconcile(t.Context()))
	require.NotContains(t, r.served, discoveryGroup)
	require.Contains(t, r.served, manifestTestGroup)
	require.False(t, r.KnownGroup(discoveryGroup))

	var list metav1.APIGroupList
	require.NoError(t, json.Unmarshal(r.apiGroupList.Load().body, &list))
	names := make([]string, 0, len(list.Groups))
	for _, g := range list.Groups {
		names = append(names, g.Name)
	}
	require.Equal(t, []string{discoveryGroup, manifestTestGroup}, names, "listed once, as the router's own")
	require.Contains(t, list.Groups, discoveryAPIGroup)

	var index handler3.OpenAPIV3Discovery
	require.NoError(t, json.Unmarshal(r.openapiIndex.Load().body, &index))
	_, url := discoveryOpenAPIEntry()
	require.Equal(t, url, index.Paths[discoveryOpenAPIPath].ServerRelativeURL)
	require.NotContains(t, index.Paths, "apis/discovery/v1")
}

func TestRenderIndexHTML(t *testing.T) {
	docs := buildManifestDocs(t.Context(), testManifestBackends())
	page := string(docs.indexHTML.body)
	require.True(t, strings.HasPrefix(page, "<!doctype html>"))
	require.Contains(t, page, "<h1>Grafana API index</h1>")
	require.Contains(t, page, "<table>")
	require.Contains(t, page, "<td><code>widgets</code></td>")
	require.Contains(t, page, `<a href="/apis/discovery/v1alpha2/manifests/`+manifestTestGroup+`">`)
	require.Contains(t, page, "Widget stats | totals per namespace", "escaped pipes render as text")

	page = string(renderIndexHTML([]byte("x <script>alert(1)</script> [a](javascript:alert(1))")))
	require.NotContains(t, page, "<script>")
	require.NotContains(t, page, `href="javascript:`)
}

// TestManifestTextCannotBreakTheIndex feeds markdown syntax through every
// place the index puts manifest text, and checks that it stays text.
func TestManifestTextCannotBreakTheIndex(t *testing.T) {
	const hostile = "a`b\\ | [x](https://evil.example) ![i](https://evil.example/i.png) *em* _u_ <b>h</b> &amp; \\"
	backends := testManifestBackends()
	m := backends[0].(*fakeManifestBackend).manifest
	m.AppDisplayName = hostile
	m.Versions[0].Kinds[0].Kind = hostile
	m.Versions[0].OpenAPI.Paths["/namespaces/{namespace}/stats"].Get.Summary = hostile
	docs := buildManifestDocs(t.Context(), backends)
	page := string(docs.indexHTML.body)

	for _, unwanted := range []string{"<a href=\"https://evil", "<img", "<em>", "<strong>", "<b>"} {
		require.NotContains(t, page, unwanted)
	}
	// Every table keeps its column count.
	for _, table := range strings.Split(page, "<table>")[1:] {
		table = table[:strings.Index(table, "</table>")]
		rows := strings.Split(table, "<tr>")[1:]
		want := strings.Count(rows[0], "<th")
		for _, row := range rows[1:] {
			require.Equal(t, want, strings.Count(row, "<td"), "row %q", row)
		}
	}
	require.Contains(t, page, "[x](https://evil.example)", "the text itself survives, as text")
}

func TestMDText(t *testing.T) {
	require.Equal(t, `a \| b \<script\>`, mdText("a |\n\tb <script>"))
	require.Equal(t, "\\\\\\` \\[x\\](y)", mdText("\\` [x](y)"), "backslashes and backticks are escaped")
	require.Equal(t, strings.Repeat("é", maxIndexTextLen)+"…", mdText(strings.Repeat("é", maxIndexTextLen+5)))
	require.Equal(t, "`GET /a\\|b`", mdCode("GET /a|`b"))
	require.Equal(t, "`a\\|`", mdCode("a\\|"), "a backslash cannot escape the pipe's escape")
	require.Empty(t, mdCode(""))
}
