package pluginroute

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

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
	"k8s.io/kube-openapi/pkg/spec3"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/app"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestHandlerServesGroupDiscovery(t *testing.T) {
	handler := withRequester(loadHandler(t, testPlugin(), allowAll(testOptions())))

	var group metav1.APIGroup
	getJSON(t, handler, "/apis/example.ext.grafana.app", &group)
	require.Equal(t, "example.ext.grafana.app", group.Name)
	require.Equal(t, "example.ext.grafana.app/v1alpha1", group.PreferredVersion.GroupVersion)
	require.Equal(t, []metav1.GroupVersionForDiscovery{
		{GroupVersion: "example.ext.grafana.app/v1alpha1", Version: "v1alpha1"},
		{GroupVersion: "example.ext.grafana.app/v0alpha1", Version: "v0alpha1"},
	}, group.Versions)

	var resources metav1.APIResourceList
	getJSON(t, handler, "/apis/example.ext.grafana.app/v1alpha1", &resources)
	names := map[string]bool{}
	for _, r := range resources.APIResources {
		names[r.Name] = true
	}
	require.True(t, names["testkinds"], "the manifest kind is served: %v", names)
	require.True(t, names["app"], "the settings resource is served: %v", names)
}

func TestHandlerServesOpenAPIV3(t *testing.T) {
	handler := withRequester(loadHandler(t, testPlugin(), allowAll(testOptions())))

	var oas spec3.OpenAPI
	getJSON(t, handler, "/openapi/v3/apis/example.ext.grafana.app/v1alpha1", &oas)
	require.Equal(t, "example.ext.grafana.app/v1alpha1", oas.Info.Title)
	require.Equal(t, "12.3.4", oas.Info.Version)

	root := "/apis/example.ext.grafana.app/v1alpha1/"
	require.Contains(t, oas.Paths.Paths, root+"namespaces/{namespace}/testkinds")
	require.Contains(t, oas.Paths.Paths, root+"namespaces/{namespace}/testkinds/{name}/reload")
}

func TestHandlerServesManifestRoutes(t *testing.T) {
	handler := withRequester(loadHandler(t, testPlugin(), allowAll(testOptions())))
	root := "/apis/example.ext.grafana.app/v1alpha1"

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
}

func TestHandlerDeniesUnauthenticatedRequests(t *testing.T) {
	handler := loadHandler(t, testPlugin(), testOptions())

	res := get(t, handler, "/apis/example.ext.grafana.app/v1alpha1/namespaces/default/testkinds")
	require.Equal(t, http.StatusUnauthorized, res.Code, res.Body.String())
}

func TestHandlerDeniesCallerWithoutPluginAccess(t *testing.T) {
	handler := withRequester(loadHandler(t, testPlugin(), testOptions()))

	res := get(t, handler, "/apis/example.ext.grafana.app/v1alpha1/namespaces/default/testkinds")
	require.Equal(t, http.StatusForbidden, res.Code, res.Body.String())
	require.Contains(t, res.Body.String(), "no plugin access checker is configured")
}

func TestHandlerSharesOneMetricsRegistry(t *testing.T) {
	opts := allowAll(testOptions())
	opts.MetricsRegister = prometheus.NewRegistry()

	loadHandler(t, testPlugin(), opts)

	t.Run("a second group loads onto the same registry", func(t *testing.T) {
		other := testPlugin()
		other.JSONData.ID = "other-app"
		other.Manifest.Group = "other.ext.grafana.app"

		handler := loadHandler(t, other, opts)
		var group metav1.APIGroup
		getJSON(t, withRequester(handler), "/apis/other.ext.grafana.app", &group)
		require.Equal(t, "other.ext.grafana.app", group.Name)
	})

	t.Run("a rebuilt group loads again", func(t *testing.T) {
		rebuilt := opts

		handler := loadHandler(t, testPlugin(), rebuilt)
		var group metav1.APIGroup
		getJSON(t, withRequester(handler), "/apis/example.ext.grafana.app", &group)
		require.Equal(t, "example.ext.grafana.app", group.Name)
	})
}

func loadHandler(t *testing.T, plugin definition.PluginDefinition, opts Options) http.Handler {
	t.Helper()
	handler, err := NewHandler(plugin, opts)
	require.NoError(t, err)
	t.Cleanup(handler.Destroy)
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

func withRequester(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ctx := identity.WithRequester(req.Context(), &identity.StaticRequester{
			Type:        claims.TypeUser,
			UserID:      1,
			OrgID:       1,
			Namespace:   "default",
			Login:       "tester",
			Name:        "tester",
			Permissions: map[int64]map[string][]string{},
		})
		handler.ServeHTTP(w, req.WithContext(ctx))
	})
}

func allowAll(opts Options) Options {
	opts.AccessChecker = func(context.Context, identity.Requester, string) (authorizer.Decision, string, error) {
		return authorizer.DecisionAllow, "", nil
	}
	return opts
}

func testOptions() Options {
	return Options{
		BuildVersion: "12.3.4",
		ClientV3:     stubClientV3{},
		Storage: func(_ *runtime.Scheme, codecs serializer.CodecFactory, gvs []schema.GroupVersion) (generic.RESTOptionsGetter, error) {
			return apistore.NewRESTOptionsGetterForClient(nil, nil,
				storagebackend.Config{Codec: codecs.LegacyCodec(gvs...)}, nil, nil), nil
		},
	}
}

var errStubRoute = errors.New("the stub plugin client was called")

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
			Group:            "example.ext.grafana.app",
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

func TestNewHandlerInvalidConfiguration(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*definition.PluginDefinition, *Options)
		want   string
	}{
		{"empty manifest", func(p *definition.PluginDefinition, _ *Options) { p.Manifest = &app.ManifestData{} }, "empty app manifest"},
		{"invalid group", func(p *definition.PluginDefinition, _ *Options) { p.Manifest.Group = "example.com" }, "invalid manifest group"},
		{"missing storage", func(_ *definition.PluginDefinition, o *Options) { o.Storage = nil }, "storage provider is required"},
		{"missing unified client", func(_ *definition.PluginDefinition, o *Options) { o.Storage = UnifiedStorage(nil, nil, nil) }, "unified storage client is required"},
		{"invalid kind", func(p *definition.PluginDefinition, _ *Options) { p.Manifest.Versions[0].Kinds[0].Kind = "Settings" }, "reserved kind name"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			plugin, opts := testPlugin(), testOptions()
			tc.change(&plugin, &opts)
			handler, err := NewHandler(plugin, opts)
			require.ErrorContains(t, err, tc.want)
			require.Nil(t, handler)
		})
	}
}

func TestAPIGroupMatchesHandler(t *testing.T) {
	plugin := testPlugin()
	expected, err := APIGroup(plugin)
	require.NoError(t, err)
	handler := withRequester(loadHandler(t, plugin, allowAll(testOptions())))
	var actual metav1.APIGroup
	getJSON(t, handler, "/apis/"+expected.Name, &actual)
	require.Equal(t, expected.Name, actual.Name)
	require.Equal(t, expected.Versions, actual.Versions)
	require.Equal(t, expected.PreferredVersion, actual.PreferredVersion)
	res := get(t, handler, "/apis/"+expected.Name+"/v2alpha1")
	require.Equal(t, http.StatusNotFound, res.Code, res.Body.String())
}

func TestHandlerWithoutManifest(t *testing.T) {
	plugin := testPlugin()
	plugin.Manifest = nil
	expected, err := APIGroup(plugin)
	require.NoError(t, err)
	require.Equal(t, plugin.JSONData.ID, expected.Name)
	require.Equal(t, []metav1.GroupVersionForDiscovery{
		{GroupVersion: "example-app/v0alpha1", Version: "v0alpha1"},
	}, expected.Versions)
	require.Equal(t, expected.Versions[0], expected.PreferredVersion)
	handler := withRequester(loadHandler(t, plugin, allowAll(testOptions())))
	var actual metav1.APIGroup
	getJSON(t, handler, "/apis/example-app", &actual)
	require.Equal(t, expected.Versions, actual.Versions)
	require.Equal(t, expected.PreferredVersion, actual.PreferredVersion)
	var resources metav1.APIResourceList
	getJSON(t, handler, "/apis/example-app/v0alpha1", &resources)
	names := make([]string, 0, len(resources.APIResources))
	for _, r := range resources.APIResources {
		names = append(names, r.Name)
	}
	require.Contains(t, names, "app")
	require.Contains(t, names, "app/health")
	require.Contains(t, names, "app/resources")

	var oas spec3.OpenAPI
	getJSON(t, handler, "/openapi/v3/apis/example-app/v0alpha1", &oas)
	require.Contains(t, oas.Paths.Paths, "/apis/example-app/v0alpha1/namespaces/{namespace}/app/instance")

	denied := withRequester(loadHandler(t, plugin, testOptions()))
	res := get(t, denied, "/apis/example-app/v0alpha1/namespaces/default/app/instance")
	require.Equal(t, http.StatusForbidden, res.Code, res.Body.String())
}

func TestHandlerDeniesOtherNamespaces(t *testing.T) {
	handler := withRequester(loadHandler(t, testPlugin(), allowAll(testOptions())))
	for _, namespace := range []string{"org-2", "invalid"} {
		res := get(t, handler, "/apis/example.ext.grafana.app/v1alpha1/namespaces/"+namespace+"/widgets")
		require.Equal(t, http.StatusForbidden, res.Code, res.Body.String())
	}
}

const testObjectJSON = `{"apiVersion":"example.ext.grafana.app/v1alpha1","kind":"TestKind","metadata":{"name":"example","namespace":"default"},"spec":{"testField":"hello"}}`

func TestHandlerResourceStorage(t *testing.T) {
	client := &resourceClient{}
	opts := allowAll(testOptions())
	opts.Storage = UnifiedStorage(client, nil, nil)
	plugin := testPlugin()
	folderScoped := false
	plugin.Manifest.Versions[0].Kinds[0].FolderScoped = &folderScoped
	handler := withRequester(loadHandler(t, plugin, opts))
	root := "/apis/example.ext.grafana.app/v1alpha1/namespaces/default/testkinds"

	res := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, root, strings.NewReader(testObjectJSON))
	req.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(res, req)
	require.Equal(t, http.StatusCreated, res.Code, res.Body.String())
	require.NotNil(t, client.created)
	require.Equal(t, "example.ext.grafana.app", client.created.Key.Group)
	require.Equal(t, "testkinds", client.created.Key.Resource)
	require.Equal(t, "default", client.created.Key.Namespace)

	res = get(t, handler, root+"/example")
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	require.Contains(t, res.Body.String(), `"testField":"hello"`)
	require.Contains(t, res.Body.String(), `"resourceVersion":"1"`)
	require.NotNil(t, client.read)
	require.Equal(t, "example", client.read.Key.Name)

	res = get(t, handler, root+"/example/reload")
	require.Contains(t, res.Body.String(), errStubRoute.Error())
}

type resourceClient struct {
	resource.ResourceClient
	created *resourcepb.CreateRequest
	read    *resourcepb.ReadRequest
}

func (c *resourceClient) Create(_ context.Context, req *resourcepb.CreateRequest, _ ...grpc.CallOption) (*resourcepb.CreateResponse, error) {
	c.created = req
	return &resourcepb.CreateResponse{ResourceVersion: 1}, nil
}

func (c *resourceClient) Read(_ context.Context, req *resourcepb.ReadRequest, _ ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	c.read = req
	return &resourcepb.ReadResponse{ResourceVersion: 1, Value: c.created.Value}, nil
}

func TestHandlerAdmission(t *testing.T) {
	for _, mutation := range []bool{false, true} {
		t.Run(fmt.Sprint("mutation=", mutation), func(t *testing.T) {
			plugin := testPlugin()
			capabilities := &app.AdmissionCapabilities{}
			if mutation {
				capabilities.Mutation = &app.MutationCapability{Operations: []app.AdmissionOperation{app.AdmissionOperationCreate}}
			} else {
				capabilities.Validation = &app.ValidationCapability{Operations: []app.AdmissionOperation{app.AdmissionOperationCreate}}
			}
			plugin.Manifest.Versions[0].Kinds[0].Admission = capabilities
			folderScoped := false
			plugin.Manifest.Versions[0].Kinds[0].FolderScoped = &folderScoped
			client := &admissionClient{}
			opts := allowAll(testOptions())
			opts.ClientV3 = client
			handler := withRequester(loadHandler(t, plugin, opts))
			res := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost,
				"/apis/example.ext.grafana.app/v1alpha1/namespaces/default/testkinds", strings.NewReader(testObjectJSON))
			req.Header.Set("Content-Type", "application/json")
			handler.ServeHTTP(res, req)
			require.Equal(t, http.StatusForbidden, res.Code, res.Body.String())
			require.NotNil(t, client.review)
			require.Equal(t, "TestKind", client.review.GetKind().GetKind())
		})
	}
}

type admissionClient struct {
	stubClientV3
	review *pluginv3.AdmissionReviewRequest
}

func (c *admissionClient) AdmissionReview(_ context.Context, req *pluginv3.AdmissionReviewRequest, _ ...grpc.CallOption) (*pluginv3.AdmissionReviewResponse, error) {
	c.review = req
	return &pluginv3.AdmissionReviewResponse{}, nil
}

func TestHandlerLegacySettings(t *testing.T) {
	for _, withManifest := range []bool{false, true} {
		t.Run(fmt.Sprint("manifest=", withManifest), func(t *testing.T) {
			plugin := testPlugin()
			if !withManifest {
				plugin.Manifest = nil
			}
			group, err := APIGroup(plugin)
			require.NoError(t, err)
			opts := allowAll(testOptions())
			opts.Runner.LegacyStore = appplugin.NewLegacySettingsStore(group.Name, plugin.JSONData.ID,
				&pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
					plugin.JSONData.ID: {Enabled: true, JSONData: map[string]any{"source": "legacy"}},
				}})
			opts.DualWrite = dualwrite.ProvideServiceForTests(nil)
			handler := withRequester(loadHandler(t, plugin, opts))
			for _, version := range group.Versions {
				var settings apppluginV0.Settings
				getJSON(t, handler, "/apis/"+version.GroupVersion+"/namespaces/default/app/"+apppluginV0.INSTANCE_NAME, &settings)
				require.True(t, settings.Spec.Enabled)
				require.Equal(t, "legacy", settings.Spec.JsonData.Object["source"])
			}
		})
	}
}
