package appplugin

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/emicklei/go-restful/v3"
	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// Registers the manifest custom routes the same way server startup does.
// A duplicate method+path registration fails the whole apiserver at startup:
// the OpenAPI builders reject it with "duplicate webservice route has been
// found for path".
func TestGetAPIRoutesRegistration(t *testing.T) {
	b := &AppPluginAPIBuilder{
		manifest:   testManifest(t),
		pluginJSON: plugins.JSONData{ID: "example-app"},
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

	// Cluster routes mount at the group-version root, namespaced ones under namespaces
	require.Contains(t, registered, "GET /apis/example-app/v1alpha1/foobar")
	require.Contains(t, registered, "GET /apis/example-app/v1alpha1/namespaces/{namespace}/foobar")
	require.Contains(t, registered, "GET /apis/example-app/v2alpha1/namespaces/{namespace}/example")
}

// A manifest route mounted on a resource path would shadow the resource and its
// generic subresources (/search, /trash), so those routes are dropped.
func TestGetAPIRoutesSkipsReservedPaths(t *testing.T) {
	manifest := testManifest(t)
	operation := manifest.Versions[1].Routes.Namespaced["/foobar"]
	manifest.Versions[1].Routes.Namespaced["/testkinds/search"] = operation
	manifest.Versions[1].Routes.Namespaced["/app"] = operation
	manifest.Versions[1].Routes.Cluster["/testkinds"] = operation

	b := &AppPluginAPIBuilder{
		manifest:   manifest,
		pluginJSON: plugins.JSONData{ID: "example-app"},
	}

	routes := b.GetAPIRoutes(schema.GroupVersion{Group: "example-app", Version: "v1alpha1"})
	require.NotNil(t, routes)

	paths := func(handlers []builder.APIRouteHandler) []string {
		out := make([]string, 0, len(handlers))
		for _, h := range handlers {
			out = append(out, h.Path)
		}
		return out
	}
	require.Equal(t, []string{"foobar", "testkinds/{name}/reload"}, paths(routes.Namespace))
	require.Equal(t, []string{"foobar"}, paths(routes.Root))
}

// A plugin without a manifest has no custom routes at all.
func TestGetAPIRoutesWithoutManifest(t *testing.T) {
	b := &AppPluginAPIBuilder{pluginJSON: plugins.JSONData{ID: "example-app"}}
	require.Nil(t, b.GetAPIRoutes(schema.GroupVersion{Group: "example-app", Version: "v0alpha1"}))
}

// A kind with no plural has no REST path to hang subresource routes off, and
// newKindStore rejects it separately.
func TestGetAPIRoutesSkipsKindsWithoutPlural(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions[1].Kinds = append(manifest.Versions[1].Kinds, app.ManifestVersionKind{
		Kind:  "NoPlural",
		Scope: "Namespaced",
		Routes: map[string]spec3.PathProps{
			"/orphan": {Get: &spec3.Operation{}},
		},
	})
	b := &AppPluginAPIBuilder{
		manifest:   manifest,
		pluginJSON: plugins.JSONData{ID: "example-app"},
	}

	routes := b.GetAPIRoutes(schema.GroupVersion{Group: "example-app", Version: "v1alpha1"})
	require.NotNil(t, routes)
	for _, h := range routes.Namespace {
		require.NotContains(t, h.Path, "orphan")
	}
}

func TestGetAPIRoutesSkipsUnservedVersions(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions[2].Served = false
	b := &AppPluginAPIBuilder{
		manifest:   manifest,
		pluginJSON: plugins.JSONData{ID: "example-app"},
	}

	require.Nil(t, b.GetAPIRoutes(schema.GroupVersion{Group: "example-app", Version: "v2alpha1"}))
}

// Kind routes are subresources of one object, so they mount under {name} and
// carry the parent resource through to the plugin.
func TestGetAPIRoutesKindRoutes(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions[1].Kinds = append(manifest.Versions[1].Kinds, app.ManifestVersionKind{
		Kind:   "ClusterKind",
		Plural: "ClusterKinds",
		Scope:  clusterScope,
		Routes: map[string]spec3.PathProps{
			"/rebuild": {Post: &spec3.Operation{OperationProps: spec3.OperationProps{
				OperationId: "rebuildClusterKind",
				Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{
					Default: &spec3.Response{ResponseProps: spec3.ResponseProps{Description: "OK"}},
				}},
			}}},
		},
	})
	// Reserved because the kind store serves <plural>/{name}/status itself.
	manifest.Versions[1].Kinds[0].Routes["/status"] = manifest.Versions[1].Kinds[0].Routes["/reload"]

	b := &AppPluginAPIBuilder{
		manifest:   manifest,
		pluginJSON: plugins.JSONData{ID: "example-app"},
	}
	routes := b.GetAPIRoutes(schema.GroupVersion{Group: "example-app", Version: "v1alpha1"})
	require.NotNil(t, routes)

	byPath := map[string]builder.APIRouteHandler{}
	for _, h := range append(slices.Clone(routes.Namespace), routes.Root...) {
		byPath[h.Path] = h
	}
	require.Contains(t, byPath, "testkinds/{name}/reload", "namespaced kinds mount under the namespace")
	require.Contains(t, byPath, "clusterkinds/{name}/rebuild", "cluster kinds mount at the group version root")
	require.NotContains(t, byPath, "testkinds/{name}/status", "status is served by the kind store")

	// The {name} segment must be documented or it is missing from the spec.
	params := byPath["testkinds/{name}/reload"].Spec.Post.Parameters
	require.Len(t, params, 1)
	require.Equal(t, nameParameter, params[0].Name)
	require.Equal(t, "path", params[0].In)
	require.True(t, params[0].Required)

	// The manifest's own operation must not gain the parameter.
	require.Empty(t, manifest.Versions[1].Kinds[0].Routes["/reload"].Post.Parameters)
}

// A route that already documents {name} must not have it added twice; the
// duplicate would be rejected when the web service is built.
func TestWithNameParameterIsIdempotent(t *testing.T) {
	declared := &spec3.Parameter{ParameterProps: spec3.ParameterProps{
		Name: nameParameter, In: "path", Required: true, Description: "declared by the plugin",
	}}
	props := spec3.PathProps{
		Get: &spec3.Operation{OperationProps: spec3.OperationProps{
			Parameters: []*spec3.Parameter{declared},
		}},
		// A nil operation is left alone rather than being materialised.
		Post: nil,
	}

	out := withNameParameter(props)

	require.Len(t, out.Get.Parameters, 1)
	require.Same(t, declared, out.Get.Parameters[0])
	require.Nil(t, out.Post)
}

func TestRouteHandlerRouteInfo(t *testing.T) {
	gv := schema.GroupVersion{Group: "example-app", Version: "v1alpha1"}
	newBuilder := func(client v3.ClientV3, get getter) *AppPluginAPIBuilder {
		return &AppPluginAPIBuilder{
			pluginJSON: plugins.JSONData{ID: "example-app"},
			clientV3:   client,
			getter:     get,
		}
	}

	t.Run("version routes carry the group version and namespace", func(t *testing.T) {
		client := &fakeRouteClient{}
		req := httptest.NewRequest(http.MethodGet, "/foobar", nil)
		req = req.WithContext(request.WithNamespace(req.Context(), "org-2"))

		// A version route has no parent, so storage is never consulted.
		newBuilder(client, nil).routeHandler(gv, "", "foobar")(httptest.NewRecorder(), req)

		require.Equal(t, "example-app", client.req.GetGroup())
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
			"apiVersion": "example-app/v1alpha1",
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
		req = req.WithContext(request.WithNamespace(req.Context(), "org-2"))
		req = mux.SetURLVars(req, map[string]string{nameParameter: "thing-1"})

		newBuilder(client, get.get).routeHandler(gv, "testkinds", "reload")(httptest.NewRecorder(), req)

		// Looked up under this version's own resource, not a hardcoded one.
		require.Equal(t, gv.WithResource("testkinds"), get.gotGVR)
		require.Equal(t, "thing-1", get.gotName)

		parent := client.req.GetParent()
		require.Equal(t, "testkinds/thing-1/reload", client.req.GetPath())
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

		newBuilder(client, get.get).routeHandler(gv, "testkinds", "reload")(
			httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/reload", nil))

		require.Equal(t, "testkinds/reload", client.req.GetPath())
		require.Nil(t, client.req.GetParent())
		require.Empty(t, get.gotName, "storage is not read when there is no name")
	})

	t.Run("a parent that cannot be read stops the request", func(t *testing.T) {
		client := &fakeRouteClient{}
		get := &recordingGetter{err: apierrors.NewNotFound(
			gv.WithResource("testkinds").GroupResource(), "thing-1")}
		rec := httptest.NewRecorder()

		req := mux.SetURLVars(httptest.NewRequest(http.MethodPost, "/reload", nil),
			map[string]string{nameParameter: "thing-1"})
		newBuilder(client, get.get).routeHandler(gv, "testkinds", "reload")(rec, req)

		// The status reason survives, so a missing object is not a plugin error.
		require.Equal(t, http.StatusNotFound, rec.Code)
		require.Nil(t, client.req, "the plugin is never called")
	})

	t.Run("an object without metadata stops the request", func(t *testing.T) {
		client := &fakeRouteClient{}
		get := &recordingGetter{obj: &metav1.Status{}}
		rec := httptest.NewRecorder()

		req := mux.SetURLVars(httptest.NewRequest(http.MethodPost, "/reload", nil),
			map[string]string{nameParameter: "thing-1"})
		newBuilder(client, get.get).routeHandler(gv, "testkinds", "reload")(rec, req)

		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.Nil(t, client.req)
	})

	t.Run("an object that cannot be encoded stops the request", func(t *testing.T) {
		client := &fakeRouteClient{}
		get := &recordingGetter{obj: &unencodableObject{}}
		rec := httptest.NewRecorder()

		req := mux.SetURLVars(httptest.NewRequest(http.MethodPost, "/reload", nil),
			map[string]string{nameParameter: "thing-1"})
		newBuilder(client, get.get).routeHandler(gv, "testkinds", "reload")(rec, req)

		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.Nil(t, client.req)
	})

	// UpdateAPIGroupInfo wires the getter. Serving before that would be a
	// startup-ordering bug, but it must not take the process down.
	t.Run("a route serving before storage is wired does not panic", func(t *testing.T) {
		client := &fakeRouteClient{}
		rec := httptest.NewRecorder()

		req := mux.SetURLVars(httptest.NewRequest(http.MethodPost, "/reload", nil),
			map[string]string{nameParameter: "thing-1"})
		require.NotPanics(t, func() {
			newBuilder(client, nil).routeHandler(gv, "testkinds", "reload")(rec, req)
		})

		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.Nil(t, client.req)
	})

	// A backend that cannot serve the route surfaces through the adapter, which
	// is also how clientWrapper reports a plugin with no v3 support.
	t.Run("a failing backend is reported to the caller", func(t *testing.T) {
		client := &fakeRouteClient{err: errors.New("no v3 backend")}
		rec := httptest.NewRecorder()

		newBuilder(client, nil).routeHandler(gv, "", "foobar")(
			rec, httptest.NewRequest(http.MethodGet, "/foobar", nil))

		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.Contains(t, rec.Body.String(), "no v3 backend")
	})
}

// fakeRouteClient records the request and returns an empty response stream.
type fakeRouteClient struct {
	v3.ClientV3
	req *pluginv3.CallRouteRequest
	err error
}

func (f *fakeRouteClient) CallRoute(_ context.Context, req *pluginv3.CallRouteRequest, _ ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
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
