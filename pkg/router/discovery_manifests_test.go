package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
	require.Contains(t, index, "Manifest: [/apis/discovery/v1alpha2/manifests/"+manifestTestGroup+"]")
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

		var version map[string]string
		rec = serve(newAuthenticatedRequest(http.MethodGet, "/apis/discovery/v1alpha2", nil))
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &version))
		require.Equal(t, map[string]string{
			"version":   "v1alpha2",
			"url":       "/apis/discovery/v1alpha2",
			"manifests": "/apis/discovery/v1alpha2/manifests",
			"index":     "/apis/discovery/v1alpha2/index.md",
			"indexHTML": "/apis/discovery/v1alpha2/index.html",
		}, version)
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

func TestMDText(t *testing.T) {
	require.Equal(t, `a \| b &lt;script&gt;`, mdText("a |\n\tb <script>"))
	require.Equal(t, strings.Repeat("é", maxIndexTextLen)+"…", mdText(strings.Repeat("é", maxIndexTextLen+5)))
	require.Equal(t, "`GET /a\\|b`", mdCode("GET /a|`b"))
	require.Empty(t, mdCode(""))
}
