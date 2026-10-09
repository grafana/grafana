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

	claims "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
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

	"github.com/grafana/grafana-app-sdk/app"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
	}, group.Versions)

	var resources metav1.APIResourceList
	getJSON(t, handler, "/apis/example.ext.grafana.app/v1alpha1", &resources)
	names := map[string]bool{}
	for _, r := range resources.APIResources {
		names[r.Name] = true
	}
	require.True(t, names["testkinds"], "the manifest kind is served: %v", names)
	require.False(t, names["app"], "manifest plugins do not serve settings: %v", names)
}

func TestHandlerServesOpenAPIV3(t *testing.T) {
	keepManifestSettings(t)
	opts := allowAll(testOptions())
	handler := withRequester(loadHandler(t, testPlugin(), opts))

	var oas spec3.OpenAPI
	getJSON(t, handler, "/openapi/v3/apis/example.ext.grafana.app/v1alpha1", &oas)
	require.Equal(t, "example.ext.grafana.app/v1alpha1", oas.Info.Title)
	require.Equal(t, "12.3.4", oas.Info.Version)

	root := "/apis/example.ext.grafana.app/v1alpha1/"
	require.Contains(t, oas.Paths.Paths, root+"namespaces/{namespace}/testkinds")
	require.Contains(t, oas.Paths.Paths, root+"namespaces/{namespace}/testkinds/{name}/reload")
	require.NotContains(t, oas.Paths.Paths, root+"namespaces/{namespace}/app/instance")
	require.NotContains(t, oas.Components.Schemas, apppluginV0.Settings{}.OpenAPIModelName())
}

func TestHandlerServesOpenAPIV3WithoutSettings(t *testing.T) {
	plugin := testPlugin()
	opts := allowAll(testOptions())
	opts.Runner.LegacyStore = appplugin.NewLegacySettingsStore(plugin.Manifests[0].Group, plugin.JSONData.ID,
		&pluginsettings.FakePluginSettings{})
	// Any attempt to construct legacy dual-write storage would call a nil service.
	opts.DualWrite = struct{ dualwrite.Service }{}
	handler := withRequester(loadHandler(t, plugin, opts))

	var oas spec3.OpenAPI
	getJSON(t, handler, "/openapi/v3/apis/example.ext.grafana.app/v1alpha1", &oas)
	require.Equal(t, "example.ext.grafana.app/v1alpha1", oas.Info.Title)

	root := "/apis/example.ext.grafana.app/v1alpha1/"
	require.Contains(t, oas.Paths.Paths, root+"namespaces/{namespace}/testkinds")
	require.Contains(t, oas.Paths.Paths, root+"namespaces/{namespace}/testkinds/{name}/reload")
	require.NotContains(t, oas.Paths.Paths, root+"namespaces/{namespace}/app/instance")
	require.NotContains(t, oas.Components.Schemas, apppluginV0.Settings{}.OpenAPIModelName())

	var resources metav1.APIResourceList
	getJSON(t, handler, "/apis/example.ext.grafana.app/v1alpha1", &resources)
	names := make([]string, 0, len(resources.APIResources))
	for _, resource := range resources.APIResources {
		names = append(names, resource.Name)
	}
	require.Contains(t, names, "testkinds")
	for _, resource := range []string{"app", "app/health", "app/resources"} {
		require.NotContains(t, names, resource)
	}
	for _, suffix := range []string{"", "/health", "/resources"} {
		res := get(t, handler, root+"namespaces/default/app/instance"+suffix)
		require.Equal(t, http.StatusNotFound, res.Code, res.Body.String())
	}
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

	// Manifest routes are matched inside the apiserver chain, so they are
	// authenticated like the resources are.
	for _, path := range []string{"namespaces/default/testkinds", "namespaces/default/widgets", "things"} {
		res := get(t, handler, "/apis/example.ext.grafana.app/v1alpha1/"+path)
		require.Equal(t, http.StatusUnauthorized, res.Code, "%s: %s", path, res.Body.String())
	}
}

func TestHandlerDeniesCallerWithoutPluginAccess(t *testing.T) {
	handler := withRequester(loadHandler(t, testPlugin(), testOptions()))

	for _, path := range []string{"namespaces/default/testkinds", "namespaces/default/widgets", "things"} {
		res := get(t, handler, "/apis/example.ext.grafana.app/v1alpha1/"+path)
		require.Equal(t, http.StatusForbidden, res.Code, "%s: %s", path, res.Body.String())
		require.Contains(t, res.Body.String(), "no plugin access checker is configured")
	}
}

func TestHandlerSharesOneMetricsRegistry(t *testing.T) {
	opts := allowAll(testOptions())
	opts.MetricsRegister = prometheus.NewRegistry()

	loadHandler(t, testPlugin(), opts)

	t.Run("a second group loads onto the same registry", func(t *testing.T) {
		other := testPlugin()
		other.JSONData.ID = "other-app"
		other.Manifests[0].Group = "other.ext.grafana.app"

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
	handler, err := NewHandler(plugin.JSONData.ID, plugin.Manifests[0], opts)
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
		BuildVersion:    "12.3.4",
		PluginClient:    struct{ appplugin.PluginClient }{},
		ContextProvider: struct{ appplugin.PluginContextWrapper }{},
		ClientV3:        stubClientV3{},
		Storage: func(_ *runtime.Scheme, codecs serializer.CodecFactory, gvs []schema.GroupVersion) (generic.RESTOptionsGetter, error) {
			return apistore.NewRESTOptionsGetterForClient(nil, nil,
				storagebackend.Config{Codec: codecs.LegacyCodec(gvs...)}, nil, nil), nil
		},
	}
}

var errStubRoute = errors.New("the stub plugin client was called")

type stubClientV3 struct{}

var _ appclientv3.Client = stubClientV3{}

func (stubClientV3) AdmissionReview(context.Context, *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	return nil, errStubRoute
}

func (stubClientV3) CallRoute(context.Context, *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	return nil, errStubRoute
}

func (stubClientV3) ConvertObjects(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	return nil, errStubRoute
}

func testPlugin() definition.PluginDefinition {
	return definition.PluginDefinition{
		JSONData: plugins.JSONData{
			ID:   "example-app",
			Type: plugins.TypeApp,
			Info: plugins.Info{Description: "An example"},
		},
		Manifests: []*app.ManifestData{{
			AppName:          "example",
			Group:            "example.ext.grafana.app",
			PreferredVersion: "v1alpha1",
			Versions: []app.ManifestVersion{
				{
					Name:   "v1alpha1",
					Served: true,
					Routes: app.ManifestVersionRoutes{ //nolint:staticcheck // SA1019: Exercise legacy manifest route compatibility.
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
		}},
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
		{"empty manifest", func(p *definition.PluginDefinition, _ *Options) { p.Manifests = []*app.ManifestData{{}} }, "empty app manifest"},
		{"invalid group", func(p *definition.PluginDefinition, _ *Options) { p.Manifests[0].Group = "example.com" }, "invalid manifest group"},
		{"missing storage", func(_ *definition.PluginDefinition, o *Options) { o.Storage = nil }, "storage provider is required"},
		{"missing unified client", func(_ *definition.PluginDefinition, o *Options) { o.Storage = UnifiedStorage(nil, nil, nil) }, "unified storage client is required"},
		{"invalid kind", func(p *definition.PluginDefinition, _ *Options) {
			p.Manifests[0].Versions[0].Kinds[0].Kind = "Settings"
		}, "reserved kind name"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			plugin, opts := testPlugin(), testOptions()
			tc.change(&plugin, &opts)
			handler, err := NewHandler(plugin.JSONData.ID, plugin.Manifests[0], opts)
			require.ErrorContains(t, err, tc.want)
			require.Nil(t, handler)
		})
	}
}

func TestValidateManifest(t *testing.T) {
	require.NoError(t, ValidateManifest("example-app", testPlugin().Manifests[0]))

	for _, tc := range []struct {
		name     string
		manifest *app.ManifestData
		want     string
	}{
		{"nil manifest", nil, "missing manifest"},
		{"empty manifest", &app.ManifestData{}, "empty app manifest"},
		{"group outside the plugin domain", &app.ManifestData{Group: "example.com", Versions: testPlugin().Manifests[0].Versions}, "invalid manifest group"},
		{"group that is not a DNS name", &app.ManifestData{Group: "Bad_Group.ext.grafana.app", Versions: testPlugin().Manifests[0].Versions}, "invalid manifest group"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.ErrorContains(t, ValidateManifest("example-app", tc.manifest), tc.want)
		})
	}
}

func TestAPIGroupMatchesHandlerWithoutSettings(t *testing.T) {
	plugin := testPlugin()
	expected := APIGroup(plugin.Manifests[0])
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
	_, err := NewHandler("example-app", nil, testOptions())
	require.ErrorContains(t, err, "missing manifest")
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
	plugin.Manifests[0].Versions[0].Kinds[0].FolderScoped = &folderScoped
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
	for _, mutation := range []bool{true} {
		t.Run(fmt.Sprint("mutation=", mutation), func(t *testing.T) {
			plugin := testPlugin()
			capabilities := &app.AdmissionCapabilities{}
			if mutation {
				capabilities.Mutation = &app.MutationCapability{Operations: []app.AdmissionOperation{app.AdmissionOperationCreate}}
			} else {
				capabilities.Validation = &app.ValidationCapability{Operations: []app.AdmissionOperation{app.AdmissionOperationCreate}}
			}
			plugin.Manifests[0].Versions[0].Kinds[0].Admission = capabilities
			folderScoped := false
			plugin.Manifests[0].Versions[0].Kinds[0].FolderScoped = &folderScoped
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

func (c *admissionClient) AdmissionReview(_ context.Context, req *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	c.review = req
	return &pluginv3.AdmissionReviewResponse{}, nil
}

func TestHandlerExcludesLegacySettings(t *testing.T) {
	keepManifestSettings(t)
	plugin := testPlugin()
	group := APIGroup(plugin.Manifests[0])
	opts := allowAll(testOptions())
	opts.Runner.LegacyStore = appplugin.NewLegacySettingsStore(group.Name, plugin.JSONData.ID,
		&pluginsettings.FakePluginSettings{})
	opts.DualWrite = dualwrite.ProvideServiceForTests(nil)
	handler := withRequester(loadHandler(t, plugin, opts))
	for _, version := range group.Versions {
		res := get(t, handler, "/apis/"+version.GroupVersion+"/namespaces/default/app/instance")
		require.Equal(t, http.StatusNotFound, res.Code)
	}
}

func keepManifestSettings(t *testing.T) {
	t.Helper()
	flag := featuremgmt.FlagApppluginsLoadAppManifestAndKeepSettings
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		flag: {Key: flag, DefaultVariant: "enabled", Variants: map[string]any{"enabled": true}},
	})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
}

func TestHandlerExcludesSettingsDespiteCompatibilityFlag(t *testing.T) {
	keepManifestSettings(t)
	opts := allowAll(testOptions())
	opts.PluginClient = nil
	opts.ContextProvider = nil
	plugin := testPlugin()
	expected := APIGroup(plugin.Manifests[0])
	handler := withRequester(loadHandler(t, plugin, opts))
	var actual metav1.APIGroup
	getJSON(t, handler, "/apis/"+expected.Name, &actual)
	require.Equal(t, expected.Versions, actual.Versions)
	require.Len(t, actual.Versions, 1)
	var oas spec3.OpenAPI
	getJSON(t, handler, "/openapi/v3/apis/example.ext.grafana.app/v1alpha1", &oas)
	require.NotContains(t, oas.Components.Schemas, apppluginV0.Settings{}.OpenAPIModelName())
}

func TestHandlerRejectsManifestWithoutServedVersions(t *testing.T) {
	plugin := testPlugin()
	for i := range plugin.Manifests[0].Versions {
		plugin.Manifests[0].Versions[i].Served = false
	}
	require.Empty(t, APIGroup(plugin.Manifests[0]).Versions)
	_, err := NewHandler(plugin.JSONData.ID, plugin.Manifests[0], testOptions())
	require.ErrorContains(t, err, "no served versions")
}

func TestAPIGroupPreferredVersion(t *testing.T) {
	for _, tc := range []struct {
		name, preferred, want string
		versions              []app.ManifestVersion
	}{
		{"explicit", "v1", "v1", []app.ManifestVersion{{Name: "v2", Served: true}, {Name: "v1", Served: true}}},
		{"stable fallback", "", "v2", []app.ManifestVersion{{Name: "v1", Served: true}, {Name: "v2", Served: true}, {Name: "v3alpha1", Served: true}}},
		{"alpha fallback", "", "v2alpha1", []app.ManifestVersion{{Name: "v1alpha1", Served: true}, {Name: "v2alpha1", Served: true}}},
		{"unserved preferred", "v2", "v1", []app.ManifestVersion{{Name: "v1", Served: true}, {Name: "v2", Served: false}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			manifest := &app.ManifestData{Group: "example.ext.grafana.app", PreferredVersion: tc.preferred, Versions: tc.versions}
			group := APIGroup(manifest)
			require.Equal(t, tc.want, group.PreferredVersion.Version)
			require.Equal(t, group.PreferredVersion, group.Versions[0])
			builder := &manifestBuilder{manifest: manifest, group: manifest.Group}
			versions := builder.GetGroupVersions()
			require.Len(t, versions, len(group.Versions))
			for i, version := range versions {
				require.Equal(t, group.Versions[i].GroupVersion, version.String())
			}
		})
	}
}

func TestHandlerOpenAPIPluginMetadata(t *testing.T) {
	for _, version := range []string{"", "1.2.3"} {
		t.Run(version, func(t *testing.T) {
			opts := allowAll(testOptions())
			opts.PluginInfo.Description = "Example plugin"
			opts.PluginInfo.Version = version
			if version != "" {
				opts.PluginInfo.Build.Time = 1234567890
			}
			handler := withRequester(loadHandler(t, testPlugin(), opts))
			var document spec3.OpenAPI
			getJSON(t, handler, "/openapi/v3/apis/example.ext.grafana.app/v1alpha1", &document)
			require.Equal(t, "Example plugin", document.Info.Description)
			info := document.Info.Extensions["x-grafana-plugin"].(map[string]any)
			require.Equal(t, "example-app", info["id"])
			if version == "" {
				require.NotContains(t, info, "version")
				require.NotContains(t, info, "build")
			} else {
				require.Equal(t, version, info["version"])
				require.Equal(t, float64(1234567890), info["build"])
			}
		})
	}
}
