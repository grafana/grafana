package pluginroute

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/emicklei/go-restful/v3"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/manifestroutes"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

// stubIndexClient is a search index that is never queried: the routes under
// test are mounted when a plugin has an index client, and their shape does not
// depend on what it answers. Embedding the interface leaves every method nil,
// so a call would panic rather than pass silently.
type stubIndexClient struct {
	resourcepb.ResourceIndexClient
}

// mountedRoutes returns the specs routeMux serves for a version, keyed by path
// relative to the group version root.
func mountedRoutes(b *manifestBuilder, gv schema.GroupVersion) map[string]*spec3.PathProps {
	out := map[string]*spec3.PathProps{}
	for _, route := range b.versionRoutes(gv, ignoreSkipped) {
		out[route.VersionPath()] = routeSpec(route)
	}
	return out
}

// The generic routes still go through the apiserver's web service, and a
// duplicate method+path registration fails the whole apiserver at startup: the
// OpenAPI builders reject it with "duplicate webservice route has been found
// for path".
func TestGetAPIRoutesRegistration(t *testing.T) {
	manifest := testManifest(t)
	hybrid := true
	manifest.Versions[1].Kinds[0].Search = &app.ManifestVersionKindSearch{Hybrid: &hybrid}
	b := &manifestBuilder{
		group:    manifest.Group,
		manifest: manifest,
		pluginID: "example-app",
		search:   stubIndexClient{},
		opts:     Options{HybridAPIEnabled: true},
	}

	container := restful.NewContainer()
	err := builder.AugmentWebServicesWithCustomRoutes(
		container, []builder.APIGroupBuilder{b}, prometheus.NewRegistry(), nil)
	require.NoError(t, err)

	registered := map[string]int{}
	for _, ws := range container.RegisteredWebServices() {
		for _, r := range ws.Routes() {
			registered[r.Method+" "+r.Path]++
		}
	}
	for route, count := range registered {
		require.Equal(t, 1, count, "duplicate route registration would fail the OpenAPI build at startup: %s", route)
	}

	// The generic subresource a namespaced kind gets. /trash is built from the
	// same resource name and is the route most likely to collide with it once it
	// is wired up, which is what the duplicate check above is guarding.
	require.Contains(t, registered, "POST /apis/example.ext.grafana.app/v1alpha1/namespaces/{namespace}/testkinds/search")
	require.Contains(t, registered, "POST /apis/example.ext.grafana.app/v1alpha1/namespaces/{namespace}/testkinds/search/hybrid")
	require.NotContains(t, registered, "POST /apis/example.ext.grafana.app/v1alpha1/namespaces/{namespace}/testkinds/trash",
		"plugin kinds are not allowed to serve trash")

	// Manifest routes are served by routeMux, not the web service.
	require.NotContains(t, registered, "GET /apis/example.ext.grafana.app/v1alpha1/foobar")
}

// A manifest route mounted on a resource path would shadow the resource and its
// generic subresources (/search, /trash), so those routes are dropped.
func TestVersionRoutesSkipReservedPaths(t *testing.T) {
	manifest := testManifest(t)
	operation := manifest.Versions[1].OpenAPI.Paths["/namespaces/{namespace}/foobar"]
	manifest.Versions[1].OpenAPI.Paths["/namespaces/{namespace}/testkinds/search"] = operation
	manifest.Versions[1].OpenAPI.Paths["/namespaces/{namespace}/app"] = operation
	manifest.Versions[1].OpenAPI.Paths["/testkinds"] = operation

	b := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app"}
	gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"}
	require.Equal(t, []string{
		"foobar",
		"namespaces/{namespace}/foobar",
		"namespaces/{namespace}/testkinds/{name}/reload",
	}, slices.Sorted(maps.Keys(mountedRoutes(b, gv))))
}

// A plugin without a manifest has no custom routes at all.
func TestGetAPIRoutesWithoutManifest(t *testing.T) {
	b := &manifestBuilder{group: "example-app", pluginID: "example-app"}
	require.Nil(t, b.GetAPIRoutes(schema.GroupVersion{Group: "example-app", Version: "v0alpha1"}))
}

// A kind with no plural has no REST path to hang subresource routes off.
// parseManifestRoutes leaves its routes out, and storage installation refuses
// the kind outright.
func TestKindsWithoutPluralNeverReachRouteRegistration(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions[1].Kinds = append(manifest.Versions[1].Kinds, app.ManifestVersionKind{
		Kind:  "NoPlural",
		Scope: "Namespaced",
	})
	manifest.Versions[1].OpenAPI.Paths["/namespaces/{namespace}//{name}/orphan"] = spec3.PathProps{Get: &spec3.Operation{}}
	b := testBuilder(t, manifest)
	for path := range mountedRoutes(b, schema.GroupVersion{Group: manifest.Group, Version: "v1alpha1"}) {
		require.NotContains(t, path, "orphan")
	}

	info, opts := testAPIGroupOptions(t, b)
	require.ErrorContains(t, b.UpdateAPIGroupInfo(info, opts),
		"kind NoPlural is missing a plural name")
}

func TestGetAPIRoutesSkipsUnservedVersions(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions[2].Served = false
	b := &manifestBuilder{
		group:    manifest.Group,
		manifest: manifest,
		pluginID: "example-app",
	}

	gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v2alpha1"}
	require.Nil(t, b.GetAPIRoutes(gv))
	require.Empty(t, b.versionRoutes(gv, ignoreSkipped))
}

// Kind routes are subresources of one object, so they mount under {name} and
// carry the parent resource through to the plugin.
func TestVersionRoutesKindRoutes(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions[1].Kinds = append(manifest.Versions[1].Kinds, app.ManifestVersionKind{
		Kind:   "ClusterKind",
		Plural: "ClusterKinds",
		Scope:  kindstore.ClusterScope,
	})
	manifest.Versions[1].OpenAPI.Paths["/clusterkinds/{name}/rebuild"] = spec3.PathProps{Post: &spec3.Operation{OperationProps: spec3.OperationProps{
		OperationId: "rebuildClusterKind",
		Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{
			Default: &spec3.Response{ResponseProps: spec3.ResponseProps{Description: "OK"}},
		}},
	}}}
	// Reserved because the kind store serves <plural>/{name}/status itself.
	manifest.Versions[1].OpenAPI.Paths["/namespaces/{namespace}/testkinds/{name}/status"] = manifest.Versions[1].OpenAPI.Paths["/namespaces/{namespace}/testkinds/{name}/reload"]

	b := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app"}
	byPath := mountedRoutes(b, schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"})
	require.Contains(t, byPath, "namespaces/{namespace}/testkinds/{name}/reload", "namespaced kinds mount under the namespace")
	require.Contains(t, byPath, "clusterkinds/{name}/rebuild", "cluster kinds mount at the group version root")
	require.NotContains(t, byPath, "namespaces/{namespace}/testkinds/{name}/status", "status is served by the kind store")

	// Every path segment must be documented or it is missing from the spec.
	pathParams := func(op *spec3.Operation) []string {
		out := make([]string, len(op.Parameters))
		for i, p := range op.Parameters {
			require.Equal(t, "path", p.In)
			require.True(t, p.Required)
			out[i] = p.Name
		}
		return out
	}
	require.Equal(t, []string{namespaceParameter, nameParameter},
		pathParams(byPath["namespaces/{namespace}/testkinds/{name}/reload"].Post),
		"namespaced kind routes mount under {namespace}/{name}")
	require.Equal(t, []string{nameParameter},
		pathParams(byPath["clusterkinds/{name}/rebuild"].Post),
		"cluster kind routes have no namespace segment")
	require.Equal(t, []string{"TestKind"}, byPath["namespaces/{namespace}/testkinds/{name}/reload"].Post.Tags)

	// The manifest's own operation must not gain the parameters.
	require.Empty(t, manifest.Versions[1].OpenAPI.Paths["/namespaces/{namespace}/testkinds/{name}/reload"].Post.Parameters)
}

// A route that already documents a path parameter must not have it added twice;
// the duplicate would be rejected when the web service is built.
func TestWithPathParametersIsIdempotent(t *testing.T) {
	declared := &spec3.Parameter{ParameterProps: spec3.ParameterProps{
		Name: nameParameter, In: "path", Required: true, Description: "declared by the plugin",
	}}
	props := spec3.PathProps{
		Get: &spec3.Operation{OperationProps: spec3.OperationProps{
			Parameters: []*spec3.Parameter{declared},
			Tags:       []string{"manifest"},
		}},
		// A nil operation is left alone rather than being materialised.
		Post: nil,
	}

	out := withPathParameters(props, nil, namespacePathParameter(), namePathParameter())

	require.Len(t, out.Get.Parameters, 2)
	require.Same(t, declared, out.Get.Parameters[0])
	require.Equal(t, namespaceParameter, out.Get.Parameters[1].Name)
	require.Equal(t, []string{"manifest"}, out.Get.Tags)
	require.Nil(t, out.Post)
}

// Namespaced version routes mount under {namespace}, so the segment must be
// documented on each of their operations; cluster routes have none.
func TestVersionRouteNamespaceParameter(t *testing.T) {
	manifest := testManifest(t)
	b := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app"}
	byPath := mountedRoutes(b, schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"})

	namespaced := byPath["namespaces/{namespace}/foobar"]
	require.NotNil(t, namespaced)
	require.Len(t, namespaced.Get.Parameters, 1)
	require.Equal(t, namespaceParameter, namespaced.Get.Parameters[0].Name)
	require.Equal(t, "path", namespaced.Get.Parameters[0].In)
	require.True(t, namespaced.Get.Parameters[0].Required)

	require.Empty(t, byPath["foobar"].Get.Parameters)
}

// The manifest's routes are matched ahead of the apiserver, and every path
// the manifest does not mount is left to it.
func TestRouteMux(t *testing.T) {
	manifest := testManifest(t)
	op := &spec3.Operation{}
	manifest.Versions[1].OpenAPI.Paths["/headonly"] = spec3.PathProps{Head: op}
	manifest.Versions[1].OpenAPI.Paths["/bad{pattern}"] = spec3.PathProps{Get: op}
	manifest.Versions[1].OpenAPI.Paths["/dir/"] = spec3.PathProps{Get: op}
	manifest.Versions[1].OpenAPI.Paths["/traceonly"] = spec3.PathProps{Trace: op, Options: op}
	manifest.Versions[1].OpenAPI.Paths["/namespaces/{namespace}/items/{item}"] = spec3.PathProps{Delete: op, Put: op, Trace: op, Options: op}

	client := &fakeRouteClient{}
	get := &recordingGetter{obj: &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "example.ext.grafana.app/v1alpha1",
		"kind":       "TestKind",
		"metadata":   map[string]any{"name": "thing-1", "namespace": "org-2"},
	}}}
	b := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app", clientV3: client, getter: get.get}

	var delegated []string
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		delegated = append(delegated, r.Method+" "+r.URL.Path)
		w.WriteHeader(http.StatusTeapot)
	})
	handler := b.routeMux(next, prometheus.NewRegistry())

	serve := func(method, path string) *httptest.ResponseRecorder {
		client.req, delegated = nil, nil
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(method, path, nil))
		return rec
	}
	root := "/apis/example.ext.grafana.app/v1alpha1/"

	serve(http.MethodGet, root+"namespaces/org-2/foobar")
	require.NotNil(t, client.req, "namespaced version route reaches the plugin")
	require.Equal(t, "org-2", client.req.GetNamespace())
	require.Equal(t, "foobar", client.req.GetPath())

	serve(http.MethodGet, root+"foobar")
	require.NotNil(t, client.req, "cluster version route reaches the plugin")
	require.Empty(t, client.req.GetNamespace())

	serve(http.MethodPost, root+"namespaces/org-2/testkinds/thing-1/reload")
	require.NotNil(t, client.req, "kind route reaches the plugin")
	require.Equal(t, "reload", client.req.GetPath())
	require.Equal(t, "thing-1", client.req.GetParent().GetName())
	require.Equal(t, "thing-1", get.gotName)

	serve(http.MethodPut, root+"namespaces/org-2/items/abc")
	require.NotNil(t, client.req, "every declared method is mounted")
	serve(http.MethodHead, root+"headonly")
	require.NotNil(t, client.req, "methods the restful mounter rejected are served")

	serve(http.MethodGet, root+"dir/")
	require.NotNil(t, client.req)
	serve(http.MethodGet, root+"dir/below")
	require.Nil(t, client.req, "a trailing slash does not mount the whole subtree")

	// The path is the plugin's, so an undeclared method is refused rather than
	// passed to the apiserver to answer 404.
	for _, tc := range []struct{ method, path, allow string }{
		{http.MethodPost, root + "foobar", "GET, HEAD"},
		{http.MethodPost, root + "namespaces/org-2/items/abc", "DELETE, PUT"},
		{http.MethodGet, root + "namespaces/org-2/testkinds/thing-1/reload", "POST"},
		// Declared, but never served.
		{http.MethodTrace, root + "namespaces/org-2/items/abc", "DELETE, PUT"},
		{http.MethodOptions, root + "namespaces/org-2/items/abc", "DELETE, PUT"},
		{http.MethodOptions, root + "foobar", "GET, HEAD"},
	} {
		rec := serve(tc.method, tc.path)
		require.Equal(t, http.StatusMethodNotAllowed, rec.Code, "%s %s", tc.method, tc.path)
		require.Equal(t, tc.allow, rec.Header().Get("Allow"))
		require.Contains(t, rec.Body.String(), `"reason":"MethodNotAllowed"`)
		require.Contains(t, rec.Body.String(), `"message":"`+tc.method+` is not supported"`)
		require.Empty(t, delegated)
		require.Nil(t, client.req)
	}

	for _, req := range [][2]string{
		{http.MethodPost, root + "namespaces/org-2/testkinds"}, // the kind's own create
		{http.MethodGet, root + "namespaces/org-2/testkinds"},
		{http.MethodGet, root + "bad{pattern}"}, // not mountable, skipped
		{http.MethodTrace, root + "traceonly"},  // no served method, so not mounted
		{http.MethodGet, "/apis/example.ext.grafana.app/v2alpha1/foobar"},
	} {
		rec := serve(req[0], req[1])
		require.Equal(t, http.StatusTeapot, rec.Code, "%s %s", req[0], req[1])
		require.Equal(t, []string{req[0] + " " + req[1]}, delegated)
		require.Nil(t, client.req)
	}
}

// TRACE and OPTIONS are never served, so they are not published either, and
// the shared manifest keeps them.
func TestVersionRoutesDropUnservedMethods(t *testing.T) {
	manifest := testManifest(t)
	op := &spec3.Operation{}
	manifest.Versions[1].OpenAPI.Paths["/mixed"] = spec3.PathProps{Get: op, Head: op, Options: op, Trace: op}
	manifest.Versions[1].OpenAPI.Paths["/traceonly"] = spec3.PathProps{Trace: op}
	b := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app"}

	byPath := mountedRoutes(b, schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"})
	require.NotContains(t, byPath, "traceonly", "a route with no served method is dropped")
	mixed := byPath["mixed"]
	require.NotNil(t, mixed)
	require.NotNil(t, mixed.Get)
	require.NotNil(t, mixed.Head)
	require.Nil(t, mixed.Options)
	require.Nil(t, mixed.Trace)

	require.NotNil(t, manifest.Versions[1].OpenAPI.Paths["/mixed"].Trace)
}

// OpenAPI allows path parameter names ServeMux does not, so they are renamed
// for matching; a path that still cannot be mounted is left out of the spec and
// the authorizer too, so neither describes a route that answers 404.
func TestVersionRoutesMuxPatterns(t *testing.T) {
	op := spec3.PathProps{Get: &spec3.Operation{}}
	manifest := testManifest(t)
	manifest.Versions[1].OpenAPI.Paths = map[string]spec3.PathProps{
		"/flags/{flag-key}": op,
		"/flags/{id}":       op, // same match as the path above, sorted after it
		"/v{version}":       op, // ServeMux has no partial wildcards
		"/namespaces/{namespace}/testkinds/{name}/a//b": op, // unclean, can never match
	}
	b := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app"}
	gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"}

	var skipped []string
	routes := b.versionRoutes(gv, func(p manifestroutes.Problem) { skipped = append(skipped, p.Path) })
	require.Len(t, routes, 1)
	require.Equal(t, "flags/{flag-key}", routes[0].Path, "the declared path is kept for the spec and the plugin")
	require.ElementsMatch(t, []string{
		"/flags/{id}", "/v{version}", "/namespaces/{namespace}/testkinds/{name}/a//b",
	}, skipped)
	require.Empty(t, kindPolicies(manifest)["testkinds"].customRoutes)

	oas := &spec3.OpenAPI{}
	b.addRoutePaths(oas, "/apis/"+gv.String()+"/", gv.Version)
	require.Equal(t, []string{"/apis/" + gv.String() + "/flags/{flag-key}"}, slices.Collect(maps.Keys(oas.Paths.Paths)))

	client := &fakeRouteClient{}
	b.clientV3 = client
	handler := b.routeMux(http.NotFoundHandler(), prometheus.NewRegistry())
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/apis/"+gv.String()+"/flags/dark-mode", nil))
	require.NotNil(t, client.req, "a renamed parameter still matches")
	require.Equal(t, "flags/{flag-key}", client.req.GetPath())
}

// A final {name:*} or {name...} segment matches the rest of the path, and is
// published as an ordinary parameter since OpenAPI has no catch-all syntax.
func TestVersionRoutesCatchAll(t *testing.T) {
	op := spec3.PathProps{Get: &spec3.Operation{}}
	manifest := testManifest(t)
	manifest.Versions[1].OpenAPI.Paths = map[string]spec3.PathProps{
		"/files/{path:*}":                                         op,
		"/namespaces/{namespace}/files/{path...}":                 op,
		"/namespaces/{namespace}/testkinds/{name}/files/{path:*}": op,
		"/broken/{path:*}/more":                                   op, // only the last segment can catch all
	}
	client := &fakeRouteClient{}
	get := &recordingGetter{obj: &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "example.ext.grafana.app/v1alpha1", "kind": "TestKind",
		"metadata": map[string]any{"name": "thing-1", "namespace": "org-2"},
	}}}
	b := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app", clientV3: client, getter: get.get}
	gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"}

	var skipped []string
	b.versionRoutes(gv, func(p manifestroutes.Problem) { skipped = append(skipped, p.Path) })
	require.Equal(t, []string{"/broken/{path:*}/more"}, skipped)

	oas := &spec3.OpenAPI{}
	root := "/apis/" + gv.String() + "/"
	b.addRoutePaths(oas, root, gv.Version)
	require.ElementsMatch(t, []string{
		root + "files/{path}",
		root + "namespaces/{namespace}/files/{path}",
		root + "namespaces/{namespace}/testkinds/{name}/files/{path}",
	}, slices.Collect(maps.Keys(oas.Paths.Paths)))

	handler := b.routeMux(http.NotFoundHandler(), prometheus.NewRegistry())
	serve := func(path string) int {
		client.req = nil
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		return rec.Code
	}

	serve(root + "files/a/b/c.txt")
	require.NotNil(t, client.req, "a cluster catch-all matches several segments")
	require.Equal(t, "files/{path:*}", client.req.GetPath(), "the plugin is sent the declared route")
	require.Contains(t, client.req.GetUrl(), "/files/a/b/c.txt", "and the URL it was called with")

	serve(root + "namespaces/org-2/files/x/y")
	require.NotNil(t, client.req)
	require.Equal(t, "org-2", client.req.GetNamespace())

	serve(root + "namespaces/org-2/testkinds/thing-1/files/deep/er")
	require.NotNil(t, client.req, "a kind catch-all matches below the object")
	require.Equal(t, "files/{path:*}", client.req.GetPath())
	require.Equal(t, "thing-1", client.req.GetParent().GetName())

	// ServeMux lets a catch-all match nothing, so the bare directory with a
	// trailing slash reaches the route, and without one is redirected to it.
	serve(root + "files/")
	require.NotNil(t, client.req)
	require.Equal(t, http.StatusTemporaryRedirect, serve(root+"files"))
	require.Nil(t, client.req)
}

// A 405 is worked out from the mounted routes, so a declared path still gets
// one when another route's wildcard covers it for a different method.
func TestRouteMuxMethodNotAllowedBesideWildcard(t *testing.T) {
	manifest := testManifest(t)
	op := &spec3.Operation{}
	manifest.Versions[1].OpenAPI.Paths = map[string]spec3.PathProps{
		"/items/{id}":    {Get: op, Delete: op},
		"/items/search":  {Post: op},
		"/items/{id}/do": {Put: op},
	}
	client := &fakeRouteClient{}
	b := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app", clientV3: client}
	require.Len(t, b.versionRoutes(schema.GroupVersion{Group: manifest.Group, Version: "v1alpha1"}, ignoreSkipped), 3,
		"no route is dropped for overlapping another")

	handler := b.routeMux(http.NotFoundHandler(), prometheus.NewRegistry())
	root := "/apis/example.ext.grafana.app/v1alpha1/"
	for _, tc := range []struct {
		method, path string
		code         int
		allow        string
	}{
		{http.MethodPost, root + "items/search", http.StatusOK, ""},
		{http.MethodGet, root + "items/search", http.StatusOK, ""}, // {id} matches it for GET
		{http.MethodPut, root + "items/search", http.StatusMethodNotAllowed, "DELETE, GET, HEAD, POST"},
		{http.MethodPost, root + "items/abc", http.StatusMethodNotAllowed, "DELETE, GET, HEAD"},
		{http.MethodGet, root + "items/abc/do", http.StatusMethodNotAllowed, "PUT"},
		{http.MethodGet, root + "items/abc/other", http.StatusNotFound, ""},
	} {
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(tc.method, tc.path, nil))
		require.Equal(t, tc.code, rec.Code, "%s %s", tc.method, tc.path)
		require.Equal(t, tc.allow, rec.Header().Get("Allow"), "%s %s", tc.method, tc.path)
	}
}

// Without routes the apiserver handler is used as is.
func TestRouteMuxWithoutRoutes(t *testing.T) {
	next := http.NewServeMux()
	b := &manifestBuilder{group: "example.ext.grafana.app"}
	require.Same(t, next, b.routeMux(next, prometheus.NewRegistry()))
}

var (
	testVersionRoute = manifestroutes.Route{Path: "foobar"}
	testKindRoute    = manifestroutes.Route{
		Path:        "testkinds/{name}/reload",
		Namespaced:  true,
		Kind:        &app.ManifestVersionKind{Kind: "TestKind", Plural: "TestKinds"},
		Subresource: "reload",
	}
)

// withPathValues sets the wildcards routeMux would have matched.
func withPathValues(req *http.Request, kv ...string) *http.Request {
	for i := 0; i+1 < len(kv); i += 2 {
		req.SetPathValue(kv[i], kv[i+1])
	}
	return req
}

func TestRouteHandlerRouteInfo(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"}
	newBuilder := func(client appclientv3.Client, get getter) *manifestBuilder {
		return &manifestBuilder{
			group:    "example.ext.grafana.app",
			pluginID: "example-app",
			clientV3: client,
			getter:   get,
		}
	}

	t.Run("version routes carry the group version and namespace", func(t *testing.T) {
		client := &fakeRouteClient{}
		req := withPathValues(httptest.NewRequest(http.MethodGet, "/foobar", nil),
			namespaceParameter, "org-2")
		route := testVersionRoute
		route.Namespaced = true

		// A version route has no parent, so storage is never consulted.
		newBuilder(client, nil).routeHandler(gv, route)(httptest.NewRecorder(), req)

		require.Equal(t, "example.ext.grafana.app", client.req.GetGroup())
		require.Equal(t, "v1alpha1", client.req.GetVersion())
		require.Equal(t, "org-2", client.req.GetNamespace())
		require.Equal(t, "foobar", client.req.GetPath())
		require.Nil(t, client.req.GetParent())
	})

	// The plugin is handed the stored object so it does not have to read it back
	// over the API, which is why the route resolves the parent before dispatch.
	t.Run("kind routes carry the parent object", func(t *testing.T) {
		client := &fakeRouteClient{}
		stored := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "example.ext.grafana.app/v1alpha1",
			"kind":       "TestKind",
			"metadata": map[string]any{
				"name":            "thing-1",
				"namespace":       "org-2",
				"resourceVersion": "42",
			},
			"spec": map[string]any{"testField": "value"},
		}}
		get := &recordingGetter{obj: stored}

		req := httptest.NewRequest(http.MethodPost, "/reload", nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{IDToken: "kind-token"}))
		req = withPathValues(req, namespaceParameter, "org-2", nameParameter, "thing-1")

		newBuilder(client, get.get).routeHandler(gv, testKindRoute)(httptest.NewRecorder(), req)

		require.NotContains(t, client.req.GetHeaders(), proxyutil.IDHeaderName, "the ID token must not be forwarded")

		// Looked up under this version's own resource, not a hardcoded one.
		require.Equal(t, gv.WithResource("testkinds"), get.gotGVR)
		require.Equal(t, "thing-1", get.gotName)

		parent := client.req.GetParent()
		require.NotNil(t, parent)
		require.Equal(t, "reload", client.req.GetPath())
		require.Equal(t, "testkinds", parent.GetResource())
		require.Equal(t, "thing-1", parent.GetName())
		require.Equal(t, "42", parent.GetRv())

		var raw map[string]any
		require.NoError(t, json.Unmarshal(parent.GetRaw(), &raw))
		require.Equal(t, stored.Object, raw, "the plugin receives the whole stored object")
	})

	// The route is only ever mounted under /{name}, so this is defensive: it must
	// still dispatch rather than send a parent with an empty name.
	t.Run("a kind route without a name dispatches without a parent", func(t *testing.T) {
		client := &fakeRouteClient{}
		get := &recordingGetter{}

		newBuilder(client, get.get).routeHandler(gv, testKindRoute)(
			httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/reload", nil))

		require.Equal(t, "reload", client.req.GetPath())
		require.Equal(t, "testkinds", client.req.GetParent().GetResource())
		require.Empty(t, get.gotName, "storage is not read when there is no name")
	})

	t.Run("a parent that cannot be read stops the request", func(t *testing.T) {
		client := &fakeRouteClient{}
		get := &recordingGetter{err: apierrors.NewNotFound(
			gv.WithResource("testkinds").GroupResource(), "thing-1")}
		rec := httptest.NewRecorder()

		req := withPathValues(httptest.NewRequest(http.MethodPost, "/reload", nil),
			nameParameter, "thing-1")
		newBuilder(client, get.get).routeHandler(gv, testKindRoute)(rec, req)

		// The status reason survives, so a missing object is not a plugin error.
		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Nil(t, client.req, "the plugin is never called")
	})

	t.Run("an object without metadata stops the request", func(t *testing.T) {
		client := &fakeRouteClient{}
		get := &recordingGetter{obj: &metav1.Status{}}
		rec := httptest.NewRecorder()

		req := withPathValues(httptest.NewRequest(http.MethodPost, "/reload", nil),
			nameParameter, "thing-1")
		newBuilder(client, get.get).routeHandler(gv, testKindRoute)(rec, req)

		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.Nil(t, client.req)
	})

	t.Run("an object that cannot be encoded stops the request", func(t *testing.T) {
		client := &fakeRouteClient{}
		get := &recordingGetter{obj: &unencodableObject{}}
		rec := httptest.NewRecorder()

		req := withPathValues(httptest.NewRequest(http.MethodPost, "/reload", nil),
			nameParameter, "thing-1")
		newBuilder(client, get.get).routeHandler(gv, testKindRoute)(rec, req)

		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.Nil(t, client.req)
	})

	// UpdateAPIGroupInfo wires the getter. Serving before that would be a
	// startup-ordering bug, but it must not take the process down.
	t.Run("a route serving before storage is wired does not panic", func(t *testing.T) {
		client := &fakeRouteClient{}
		rec := httptest.NewRecorder()

		req := withPathValues(httptest.NewRequest(http.MethodPost, "/reload", nil),
			nameParameter, "thing-1")
		require.NotPanics(t, func() {
			newBuilder(client, nil).routeHandler(gv, testKindRoute)(rec, req)
		})

		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.Nil(t, client.req)
	})

	// A backend that cannot serve the route surfaces through the adapter, which
	// is also how clientWrapper reports a plugin with no v3 support.
	t.Run("a failing backend is reported to the caller", func(t *testing.T) {
		client := &fakeRouteClient{err: errors.New("no v3 backend")}
		rec := httptest.NewRecorder()

		newBuilder(client, nil).routeHandler(gv, testVersionRoute)(
			rec, httptest.NewRequest(http.MethodGet, "/foobar", nil))

		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.Contains(t, rec.Body.String(), "no v3 backend")
	})
}

func TestRouteHandlerDoesNotForwardCredentials(t *testing.T) {
	for _, tc := range []struct {
		name      string
		requester identity.Requester
	}{
		{
			name:      "does not forward the requester's ID token",
			requester: &identity.StaticRequester{IDToken: "verified-token"},
		},
		{
			name: "removes untrusted identity without a requester",
		},
		{
			name:      "removes untrusted identity without an ID token",
			requester: &identity.StaticRequester{},
		},
		{
			name:      "does not forward the requester's access token",
			requester: &identity.StaticRequester{AccessToken: "access-token"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &fakeRouteClient{}
			b := &manifestBuilder{clientV3: client}
			req := httptest.NewRequest(http.MethodGet, "/foobar", nil)
			req.Header.Add(proxyutil.IDHeaderName, "untrusted-token")
			req.Header.Add(proxyutil.IDHeaderName, "another-untrusted-token")
			req.Header.Set("Authorization", "Bearer user-token")
			req.Header.Set("Cookie", "grafana_session=secret")
			req.Header.Set("X-Request-Id", "request-id")
			originalHeaders := req.Header.Clone()
			if tc.requester != nil {
				req = req.WithContext(identity.WithRequester(req.Context(), tc.requester))
			}
			rec := httptest.NewRecorder()

			b.routeHandler(schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"}, testVersionRoute)(rec, req)

			require.Equal(t, http.StatusOK, rec.Code)
			require.NotNil(t, client.req)
			headers := client.req.GetHeaders()
			require.NotContains(t, headers, proxyutil.IDHeaderName)
			require.NotContains(t, headers, "X-Access-Token")
			require.NotContains(t, headers, "Authorization")
			require.NotContains(t, headers, "Cookie")
			require.Equal(t, []string{"request-id"}, headers["X-Request-Id"].GetValues())
			require.Equal(t, originalHeaders, req.Header)
		})
	}
}

// fakeRouteClient records the request and returns an empty response stream.
type fakeRouteClient struct {
	appclientv3.Client
	req *pluginv3.CallRouteRequest
	err error
}

func (f *fakeRouteClient) CallRoute(_ context.Context, req *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	if f.err != nil {
		return nil, f.err
	}
	f.req = req
	return &fakeRouteStream{}, nil
}

type fakeRouteStream struct {
	grpc.ServerStreamingClient[pluginv3.CallRouteResponse]
}

func (*fakeRouteStream) Recv() (*pluginv3.CallRouteResponse, error) { return nil, io.EOF }

// recordingGetter stands in for the per-GVR storage lookup built in
// UpdateAPIGroupInfo.
type recordingGetter struct {
	obj     runtime.Object
	err     error
	gotGVR  schema.GroupVersionResource
	gotName string
}

func (g *recordingGetter) get(_ context.Context, gvr schema.GroupVersionResource, name string) (runtime.Object, error) {
	g.gotGVR = gvr
	g.gotName = name
	return g.obj, g.err
}

// unencodableObject has metadata but cannot be marshalled to JSON.
type unencodableObject struct {
	metav1.ObjectMeta
	Bad chan int `json:"bad"`
}

func (*unencodableObject) GetObjectKind() schema.ObjectKind { return schema.EmptyObjectKind }
func (o *unencodableObject) DeepCopyObject() runtime.Object { return o }

// Which kinds get the generic search endpoints is decided by searchroutes, so a
// manifest kind is treated the same whether this builder serves it or a custom
// resource definition does. These are that package's rules, asserted here
// because mounting them is this builder's job.
func TestSearchRouteGates(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"}

	newBuilder := func(opts Options) *manifestBuilder {
		manifest := testManifest(t)
		return &manifestBuilder{
			group:    manifest.Group,
			manifest: manifest,
			pluginID: "example-app",
			search:   stubIndexClient{},
			opts:     opts,
		}
	}

	searchPaths := func(b *manifestBuilder) []string {
		t.Helper()
		handlers, err := b.searchRoutes(gv)
		require.NoError(t, err)
		out := make([]string, len(handlers))
		for i, h := range handlers {
			out[i] = h.Path
		}
		return out
	}

	t.Run("search is always enabled for eligible kinds", func(t *testing.T) {
		require.Equal(t, []string{"testkinds/search"}, searchPaths(newBuilder(Options{})))
	})

	t.Run("hybrid requires manifest opt-in", func(t *testing.T) {
		b := newBuilder(Options{HybridAPIEnabled: true})
		require.Equal(t, []string{"testkinds/search"}, searchPaths(b))

		hybrid := true
		b.manifest.Versions[1].Kinds[0].Search = &app.ManifestVersionKindSearch{Hybrid: &hybrid}
		require.Equal(t, []string{"testkinds/search", "testkinds/search/hybrid"}, searchPaths(b))
	})

	t.Run("hybrid serves when the kind opts out of lexical search", func(t *testing.T) {
		b := newBuilder(Options{HybridAPIEnabled: true})
		hybrid, endpoint := true, false
		b.manifest.Versions[1].Kinds[0].Search = &app.ManifestVersionKindSearch{Endpoint: &endpoint, Hybrid: &hybrid}
		require.Equal(t, []string{"testkinds/search/hybrid"}, searchPaths(b))

		b.opts.HybridAPIEnabled = false
		require.Empty(t, searchPaths(b))
	})

	t.Run("hybrid follows the served group when it differs from the manifest", func(t *testing.T) {
		b := newBuilder(Options{HybridAPIEnabled: true})
		hybrid := true
		b.manifest.Group = "other.ext.grafana.app"
		b.manifest.Versions[1].Kinds[0].Search = &app.ManifestVersionKindSearch{Hybrid: &hybrid}
		require.Equal(t, []string{"testkinds/search", "testkinds/search/hybrid"}, searchPaths(b))
	})

	t.Run("hybrid is not served for cluster scoped kinds", func(t *testing.T) {
		b := newBuilder(Options{HybridAPIEnabled: true})
		hybrid := true
		b.manifest.Versions[1].Kinds[0].Search = &app.ManifestVersionKindSearch{Hybrid: &hybrid}
		b.manifest.Versions[1].Kinds[0].Scope = kindstore.ClusterScope
		require.Empty(t, searchPaths(b))
	})

	// Search over the fields every resource has works without declared fields,
	// so declaring none is not a reason to withhold the endpoint.
	t.Run("a kind declaring no search fields is still served", func(t *testing.T) {
		b := newBuilder(Options{})
		b.manifest.Versions[1].Kinds[0].SearchFields = nil
		require.Equal(t, []string{"testkinds/search"}, searchPaths(b))
	})

	t.Run("a kind can opt out of the endpoint it declared fields for", func(t *testing.T) {
		b := newBuilder(Options{})
		off := false
		b.manifest.Versions[1].Kinds[0].Search = &app.ManifestVersionKindSearch{Endpoint: &off}
		require.Empty(t, searchPaths(b))
	})

	t.Run("a cluster scoped kind has no namespace to search", func(t *testing.T) {
		b := newBuilder(Options{})
		b.manifest.Versions[1].Kinds[0].Scope = kindstore.ClusterScope
		require.Empty(t, searchPaths(b))
	})

	// Trash grants access to whoever deleted the object, so searchroutes holds
	// an allowlist that no plugin kind is on.
	t.Run("trash is not served for a plugin kind", func(t *testing.T) {
		require.Equal(t, []string{"testkinds/search"}, searchPaths(newBuilder(Options{})))
	})

	t.Run("no index client, nothing to serve", func(t *testing.T) {
		b := newBuilder(Options{})
		b.search = nil
		require.Empty(t, searchPaths(b))
	})
}

// A manifest still carrying the deprecated routes was not loaded through
// definition, so it is refused rather than served without them.
func TestValidateManifestRejectsDeprecatedRoutes(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions[1].Routes.Cluster = map[string]spec3.PathProps{"/stale": {Get: &spec3.Operation{}}} //nolint:staticcheck // SA1019: the input being refused.
	require.ErrorContains(t, ValidateManifest("example-app", manifest), "version v1alpha1 still has deprecated routes")

	definition.MigrateDeprecatedRoutes(manifest)
	require.NoError(t, ValidateManifest("example-app", manifest))
}

// OpenAPI paths that would shadow resource storage, or that mount a kind's
// subresource at the wrong scope, are dropped.
func TestVersionRoutesFromOpenAPIPathsSkipShadowing(t *testing.T) {
	op := spec3.PathProps{Get: &spec3.Operation{}}
	manifest := testManifest(t)
	manifest.Versions[1].OpenAPI.Paths = map[string]spec3.PathProps{
		"/namespaces/{namespace}/ok": op,
		"/ok":                        op,
		"/namespaces/{namespace}/testkinds/{name}/sub":      op,
		"/namespaces/{namespace}/testkinds/{name}/status":   op, // reserved subresource
		"/namespaces/{namespace}/testkinds/{name}/status/x": op, // below a reserved subresource
		"/namespaces/{namespace}/testkinds/search":          op, // shadows the resource
		"/testkinds/{name}/sub":                             op, // namespaced kind at cluster scope
		"/namespaces/{other}/x":                             op, // not the namespace mount point
		"/namespaces/{namespace}/app":                       op, // settings resource
	}
	b := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app"}
	require.Equal(t, []string{
		"namespaces/{namespace}/ok",
		"namespaces/{namespace}/testkinds/{name}/sub",
		"ok",
	}, slices.Sorted(maps.Keys(mountedRoutes(b, schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"}))))

	// The authorizer allows exactly the subresources that are mounted.
	require.Equal(t, map[string]bool{"sub": true}, kindPolicies(manifest)["testkinds"].customRoutes)
}

// A parent whose secure values cannot be decrypted is not sent to the plugin
// at all, rather than without them.
func TestRouteHandlerStopsWhenSecureValuesCannotBeDecrypted(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.ext.grafana.app", Version: "v1alpha1"}
	parent := &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": gv.String(), "kind": "TestKind",
		"metadata": map[string]any{"name": "thing-1", "namespace": "org-2"},
		"secure":   map[string]any{"apiKey": map[string]any{"name": "router-api-key"}},
	}}
	client := &fakeRouteClient{}
	b := &manifestBuilder{
		group:    gv.Group,
		clientV3: client,
		getter:   (&recordingGetter{obj: parent}).get,
		decrypter: newSecureValueLookup(secureLookupDecrypter(func(context.Context, string, string, ...string) (map[string]decrypt.DecryptResult, error) {
			return nil, errors.New("secrets unavailable")
		})),
	}
	req := withPathValues(httptest.NewRequest(http.MethodPost, "/reload", nil), namespaceParameter, "org-2", nameParameter, "thing-1")
	rec := httptest.NewRecorder()
	b.routeHandler(gv, testKindRoute).ServeHTTP(rec, req)

	require.Equal(t, http.StatusInternalServerError, rec.Code)
	require.NotContains(t, rec.Body.String(), "secrets unavailable", "the cause is not sent to the caller")
	require.Nil(t, client.req, "the plugin is never called")
}

// A manifest whose every route is rejected mounts nothing, so the API server's
// handler is used as is.
func TestRouteMuxWithOnlyRejectedRoutes(t *testing.T) {
	manifest := testManifest(t)
	for i := range manifest.Versions {
		manifest.Versions[i].OpenAPI.Paths = map[string]spec3.PathProps{
			"/namespaces/{namespace}/app/x": {Get: &spec3.Operation{}}, // the settings resource
		}
	}
	next := http.NewServeMux()
	b := &manifestBuilder{group: manifest.Group, manifest: manifest}
	require.Same(t, next, b.routeMux(next, prometheus.NewRegistry()))
}

// A manifest whose search declarations cannot be read loses search, and only
// search: its custom routes are still served.
func TestGetAPIRoutesWithInvalidSearchDeclarations(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions[1].Kinds[0].SearchFields = []app.ManifestVersionKindSearchField{{
		// Text search applies to strings only.
		Name: "testField", Path: "spec.testField", Type: "int64", Capabilities: []string{"text"},
	}}
	b := &manifestBuilder{group: manifest.Group, manifest: manifest, pluginID: "example-app", search: stubIndexClient{}}
	gv := schema.GroupVersion{Group: manifest.Group, Version: "v1alpha1"}

	require.Nil(t, b.GetAPIRoutes(gv), "no search, trash or hybrid routes")
	require.Contains(t, mountedRoutes(b, gv), "namespaces/{namespace}/foobar")
}
