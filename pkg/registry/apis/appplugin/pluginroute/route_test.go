package pluginroute

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-logr/logr"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/klog/v2"
	"k8s.io/kube-openapi/pkg/spec3"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/app"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

// TestMain quiets the apiserver machinery's reports about each server the tests
// build, which say nothing about the behaviour under test.
func TestMain(m *testing.M) {
	klog.SetLogger(logr.Discard())
	m.Run()
}

var _ router.Backend = (*Backend)(nil)

func TestNewRejectsIncompleteInput(t *testing.T) {
	t.Run("a plugin with no manifest has no group to route", func(t *testing.T) {
		plugin := testPlugin()
		plugin.Manifest = nil
		_, err := New(plugin, testOptions())
		require.ErrorContains(t, err, "no app manifest")
	})

	t.Run("an empty manifest is the same as none", func(t *testing.T) {
		plugin := testPlugin()
		plugin.Manifest = &app.ManifestData{}
		_, err := New(plugin, testOptions())
		require.ErrorContains(t, err, "no app manifest")
	})

	t.Run("kinds cannot be served without storage", func(t *testing.T) {
		opts := testOptions()
		opts.Storage = nil
		_, err := New(testPlugin(), opts)
		require.ErrorContains(t, err, "StorageProvider is required")
	})

	t.Run("the router cannot reconcile a backend with no resource version", func(t *testing.T) {
		opts := testOptions()
		opts.ResourceVersion = ""
		_, err := New(testPlugin(), opts)
		require.ErrorContains(t, err, "resource version is required")
	})
}

// The router advertises the group from Manifest(), so it has to describe what
// is served rather than what the manifest happens to say.
func TestManifestDescribesWhatIsServed(t *testing.T) {
	b, err := New(testPlugin(), testOptions())
	require.NoError(t, err)

	m := b.Manifest()
	require.Equal(t, "example.ext.grafana.com", m.Group)
	require.Equal(t, "example.ext.grafana.com", b.Group())
	require.Equal(t, "rv-1", b.RV())

	// v1alpha1 from the manifest, then the settings version every app plugin
	// serves whether or not its manifest mentions one. The unserved v2alpha1 is
	// gone: advertising it would route requests to a version with no storage.
	names := make([]string, 0, len(m.Versions))
	for _, v := range m.Versions {
		require.True(t, v.Served, "an unserved version must not be advertised: %s", v.Name)
		names = append(names, v.Name)
	}
	require.Equal(t, []string{"v1alpha1", "v0alpha1"}, names)
	require.Equal(t, "v1alpha1", m.PreferredVersion)

	// The declared version keeps what it declared; the synthesized one has
	// nothing of its own to carry.
	require.Len(t, m.Versions[0].Kinds, 1)
	require.Empty(t, m.Versions[1].Kinds)
}

// A manifest that declares no group is still served, under the plugin id. The
// router would otherwise advertise a group with no name.
func TestManifestGroupFallsBackToPluginID(t *testing.T) {
	plugin := testPlugin()
	plugin.Manifest.Group = ""

	b, err := New(plugin, testOptions())
	require.NoError(t, err)
	require.Equal(t, "example-app", b.Group())
	require.Equal(t, "example-app", b.Manifest().Group)
}

// Group discovery is proxied straight to the owning backend, so this is what a
// client asking the router about the group gets.
func TestLoadServesGroupDiscovery(t *testing.T) {
	handler := withRequester(loadHandler(t, testPlugin(), allowAll(testOptions())))

	var group metav1.APIGroup
	getJSON(t, handler, "/apis/example.ext.grafana.com", &group)
	require.Equal(t, "example.ext.grafana.com", group.Name)
	require.Equal(t, "example.ext.grafana.com/v1alpha1", group.PreferredVersion.GroupVersion)
	require.Equal(t, []metav1.GroupVersionForDiscovery{
		{GroupVersion: "example.ext.grafana.com/v1alpha1", Version: "v1alpha1"},
		{GroupVersion: "example.ext.grafana.com/v0alpha1", Version: "v0alpha1"},
	}, group.Versions)

	var resources metav1.APIResourceList
	getJSON(t, handler, "/apis/example.ext.grafana.com/v1alpha1", &resources)
	names := map[string]bool{}
	for _, r := range resources.APIResources {
		names[r.Name] = true
	}
	// The manifest kind, and the settings resource every app plugin serves.
	require.True(t, names["testkinds"], "the manifest kind is served: %v", names)
	require.True(t, names["app"], "the settings resource is served: %v", names)
}

// The router proxies /openapi/v3/apis/{group}/{version} to the owning backend
// and caches the result, so the endpoint has to exist on this handler. It only
// does because Load calls PrepareRun.
func TestLoadServesOpenAPIV3(t *testing.T) {
	handler := withRequester(loadHandler(t, testPlugin(), allowAll(testOptions())))

	var oas spec3.OpenAPI
	getJSON(t, handler, "/openapi/v3/apis/example.ext.grafana.com/v1alpha1", &oas)
	require.Equal(t, "example.ext.grafana.com/v1alpha1", oas.Info.Title)
	require.Equal(t, "12.3.4", oas.Info.Version)

	root := "/apis/example.ext.grafana.com/v1alpha1/"
	require.Contains(t, oas.Paths.Paths, root+"namespaces/{namespace}/testkinds")
	// A custom route from the manifest, which only this backend can serve.
	require.Contains(t, oas.Paths.Paths, root+"namespaces/{namespace}/testkinds/{name}/reload")
}

// A manifest's custom routes are not resource storage, so they are mounted
// separately from the group. Missing that step costs every declared route with
// no error anywhere -- an unmatched path is just a not-found.
func TestLoadServesManifestRoutes(t *testing.T) {
	handler := withRequester(loadHandler(t, testPlugin(), allowAll(testOptions())))
	root := "/apis/example.ext.grafana.com/v1alpha1"

	// A version's routes go straight to the plugin, so reaching the client is
	// the whole of what they do -- and proves the route is mounted rather than
	// merely absent in a different way.
	for _, path := range []string{
		root + "/things",                     // cluster
		root + "/namespaces/default/widgets", // namespaced
	} {
		t.Run(path, func(t *testing.T) {
			res := get(t, handler, path)
			require.Contains(t, res.Body.String(), errStubRoute.Error(),
				"the route did not reach the plugin (%d)", res.Code)
		})
	}

	// A kind's route looks its parent object up first, which needs storage this
	// test does not have, so it stops short of the plugin. Mounted is all that
	// can be checked here.
	t.Run(root+"/namespaces/default/testkinds/{name}/reload", func(t *testing.T) {
		res := get(t, handler, root+"/namespaces/default/testkinds/some-name/reload")
		require.NotEqual(t, http.StatusNotFound, res.Code,
			"the route is not mounted: %s", res.Body.String())
	})
}

// The router's port runs outside the Kubernetes handler chain, so a request
// nothing authenticated must be refused rather than served to anyone that
// reached the port.
func TestLoadDeniesUnauthenticatedRequests(t *testing.T) {
	handler := loadHandler(t, testPlugin(), testOptions())

	res := get(t, handler, "/apis/example.ext.grafana.com/v1alpha1/namespaces/default/testkinds")
	require.Equal(t, http.StatusUnauthorized, res.Code, res.Body.String())
}

// An authenticated caller is still measured against the group's own authorizer,
// which asks access control whether this caller may reach this plugin. With no
// access control to ask, the answer is no -- not an unchecked yes, and not the
// nil dereference asking would otherwise be.
func TestLoadDeniesCallerWithoutPluginAccess(t *testing.T) {
	handler := withRequester(loadHandler(t, testPlugin(), testOptions()))

	res := get(t, handler, "/apis/example.ext.grafana.com/v1alpha1/namespaces/default/testkinds")
	require.Equal(t, http.StatusForbidden, res.Code, res.Body.String())
	require.Contains(t, res.Body.String(), "no access control is configured")
}

// Every group in the process shares one registry, and a group is rebuilt
// whenever its config changes. The handler chain creates its own collectors
// under a fixed name and registers them with promauto, which panics rather than
// returns -- so without replacingRegisterer either of these takes the router
// down rather than failing one group's load.
func TestLoadSharesOneMetricsRegistry(t *testing.T) {
	opts := allowAll(testOptions())
	opts.MetricsRegister = prometheus.NewRegistry()

	loadHandler(t, testPlugin(), opts)

	t.Run("a second group loads onto the same registry", func(t *testing.T) {
		other := testPlugin()
		other.JSONData.ID = "other-app"
		other.Manifest.Group = "other.ext.grafana.com"

		handler := loadHandler(t, other, opts)
		var group metav1.APIGroup
		getJSON(t, withRequester(handler), "/apis/other.ext.grafana.com", &group)
		require.Equal(t, "other.ext.grafana.com", group.Name)
	})

	t.Run("a rebuilt group loads again", func(t *testing.T) {
		rebuilt := opts
		rebuilt.ResourceVersion = "rv-2"

		handler := loadHandler(t, testPlugin(), rebuilt)
		var group metav1.APIGroup
		getJSON(t, withRequester(handler), "/apis/example.ext.grafana.com", &group)
		require.Equal(t, "example.ext.grafana.com", group.Name)
	})
}

func loadHandler(t *testing.T, plugin definition.PluginDefinition, opts Options) http.Handler {
	t.Helper()

	b, err := New(plugin, opts)
	require.NoError(t, err)
	t.Cleanup(b.Destroy)

	handler, err := b.Load(context.Background())
	require.NoError(t, err)
	require.NotNil(t, handler)
	return handler
}

func get(t *testing.T, handler http.Handler, path string) *httptest.ResponseRecorder {
	t.Helper()

	res := httptest.NewRecorder()
	handler.ServeHTTP(res, httptest.NewRequest(http.MethodGet, path, nil))
	return res
}

func getJSON(t *testing.T, handler http.Handler, path string, into any) {
	t.Helper()

	res := get(t, handler, path)
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), into))
}

// withRequester puts a caller on the request context, which is where the group
// reads identity from: an outer middleware resolves it, exactly as Grafana's
// own HTTP stack does ahead of its API server. See Load.
func withRequester(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ctx := identity.WithRequester(req.Context(), &identity.StaticRequester{
			Type:        claims.TypeUser,
			UserID:      1,
			OrgID:       1,
			Login:       "tester",
			Name:        "tester",
			Permissions: map[int64]map[string][]string{},
		})
		handler.ServeHTTP(w, req.WithContext(ctx))
	})
}

// allowAll replaces the group's own authorizer, which asks access control about
// the caller. Tests that are not about authorization need past it.
func allowAll(opts Options) Options {
	opts.Authorizer = authorizer.AuthorizerFunc(
		func(context.Context, authorizer.Attributes) (authorizer.Decision, string, error) {
			return authorizer.DecisionAllow, "", nil
		})
	return opts
}

func testOptions() Options {
	return Options{
		ResourceVersion: "rv-1",
		BuildVersion:    "12.3.4",
		// The manifest's routes dispatch to this, so it has to exist for them
		// to be reachable at all.
		ClientV3: stubClientV3{},
		// Storage is installed but never read: these tests reach discovery and
		// authorization, neither of which touches a stored object.
		Storage: func(_ *runtime.Scheme, codecs serializer.CodecFactory, gvs []schema.GroupVersion) (generic.RESTOptionsGetter, error) {
			return apistore.NewRESTOptionsGetterForClient(nil, nil,
				storagebackend.Config{Codec: codecs.LegacyCodec(gvs...)}, nil, nil), nil
		},
	}
}

// errStubRoute is what a manifest route's dispatch returns here, so a test can
// tell "reached the plugin" from "never got there".
var errStubRoute = errors.New("the stub plugin client was called")

// stubClientV3 stands in for the plugin backend. Nothing in these tests is
// answered by a plugin; they check that requests arrive at one.
type stubClientV3 struct{}

var _ v3.ClientV3 = stubClientV3{}

func (stubClientV3) AdmissionReview(context.Context, *pluginv3.AdmissionReviewRequest, ...grpc.CallOption) (*pluginv3.AdmissionReviewResponse, error) {
	return nil, errStubRoute
}

func (stubClientV3) CallRoute(context.Context, *pluginv3.CallRouteRequest, ...grpc.CallOption) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	return nil, errStubRoute
}

func (stubClientV3) ConvertObjects(context.Context, *pluginv3.ConvertObjectsRequest, ...grpc.CallOption) (*pluginv3.ConvertObjectsResponse, error) {
	return nil, errStubRoute
}

func testPlugin() definition.PluginDefinition {
	return definition.PluginDefinition{
		JSONData: plugins.JSONData{
			ID:   "example-app",
			Type: plugins.TypeApp,
			Info: plugins.Info{Description: "An example"},
		},
		Manifest: &app.ManifestData{
			AppName:          "example",
			Group:            "example.ext.grafana.com",
			PreferredVersion: "v1alpha1",
			Versions: []app.ManifestVersion{
				{
					Name:   "v1alpha1",
					Served: true,
					Routes: app.ManifestVersionRoutes{
						Cluster:    map[string]spec3.PathProps{"/things": {Get: testOperation("listThings")}},
						Namespaced: map[string]spec3.PathProps{"/widgets": {Get: testOperation("listWidgets")}},
					},
					Kinds: []app.ManifestVersionKind{{
						Kind:   "TestKind",
						Plural: "TestKinds",
						Scope:  "Namespaced",
						Schema: testSchema(),
						Routes: map[string]spec3.PathProps{
							"/reload": {Get: testOperation("reloadTestKind")},
						},
					}},
				},
				{Name: "v2alpha1", Served: false},
			},
		},
	}
}

// testOperation is the smallest declaration a route needs to be mounted and
// described.
func testOperation(id string) *spec3.Operation {
	return &spec3.Operation{OperationProps: spec3.OperationProps{
		OperationId: id,
		Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{
			Default: &spec3.Response{ResponseProps: spec3.ResponseProps{Description: "OK"}},
		}},
	}}
}

func testSchema() *app.VersionSchema {
	var schema app.VersionSchema
	if err := json.Unmarshal([]byte(`{
		"TestKind":{"type":"object","properties":{"spec":{"$ref":"#/components/schemas/spec"}},"required":["spec"]},
		"spec":{"type":"object","additionalProperties":false,"properties":{"testField":{"type":"string"}},"required":["testField"]}
	}`), &schema); err != nil {
		panic(err)
	}
	return &schema
}
