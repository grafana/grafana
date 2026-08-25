package appplugin

import (
	"context"
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
	newBuilder := func(client v3.ClientV3, ok bool) *AppPluginAPIBuilder {
		return &AppPluginAPIBuilder{
			pluginJSON:     plugins.JSONData{ID: "example-app"},
			clientV3Loader: fakeClientV3Loader{client: client, ok: ok},
		}
	}

	t.Run("version routes carry the group version and namespace", func(t *testing.T) {
		client := &fakeRouteClient{}
		req := httptest.NewRequest(http.MethodGet, "/foobar", nil)
		req = req.WithContext(request.WithNamespace(req.Context(), "org-2"))

		newBuilder(client, true).routeHandler(gv, "", "foobar")(httptest.NewRecorder(), req)

		require.Equal(t, "example-app", client.req.GetGroup())
		require.Equal(t, "v1alpha1", client.req.GetVersion())
		require.Equal(t, "org-2", client.req.GetNamespace())
		require.Equal(t, "foobar", client.req.GetPath())
		require.Nil(t, client.req.GetParent())
	})

	t.Run("kind routes carry the parent object", func(t *testing.T) {
		client := &fakeRouteClient{}
		req := httptest.NewRequest(http.MethodPost, "/reload", nil)
		req = req.WithContext(request.WithNamespace(req.Context(), "org-2"))
		req = mux.SetURLVars(req, map[string]string{nameParameter: "thing-1"})

		newBuilder(client, true).routeHandler(gv, "testkinds", "reload")(httptest.NewRecorder(), req)

		require.Equal(t, "testkinds/thing-1/reload", client.req.GetPath())
		require.Equal(t, "testkinds", client.req.GetParent().GetResource())
		require.Equal(t, "thing-1", client.req.GetParent().GetName())
	})

	t.Run("a kind route without a name is rejected", func(t *testing.T) {
		client := &fakeRouteClient{}
		rec := httptest.NewRecorder()

		newBuilder(client, true).routeHandler(gv, "testkinds", "reload")(
			rec, httptest.NewRequest(http.MethodPost, "/reload", nil))

		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Nil(t, client.req)
	})

	t.Run("a plugin without a v3 backend reports unavailable", func(t *testing.T) {
		rec := httptest.NewRecorder()

		newBuilder(nil, false).routeHandler(gv, "", "foobar")(
			rec, httptest.NewRequest(http.MethodGet, "/foobar", nil))

		require.Equal(t, http.StatusServiceUnavailable, rec.Code)
	})
}

type fakeClientV3Loader struct {
	client v3.ClientV3
	ok     bool
}

func (f fakeClientV3Loader) ClientV3(context.Context, string) (v3.ClientV3, bool) {
	return f.client, f.ok
}

// fakeRouteClient records the request and returns an empty response stream.
type fakeRouteClient struct {
	v3.ClientV3
	req *pluginv3.CallRouteRequest
}

func (f *fakeRouteClient) CallRoute(_ context.Context, req *pluginv3.CallRouteRequest, _ ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	f.req = req
	return &fakeRouteStream{}, nil
}

type fakeRouteStream struct {
	grpc.ServerStreamingClient[pluginv3.CallRouteResponse]
}

func (*fakeRouteStream) Recv() (*pluginv3.CallRouteResponse, error) { return nil, io.EOF }
