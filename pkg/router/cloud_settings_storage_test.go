package router

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metainternal "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	appv0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/appsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestCloudSettingsStorageModes(t *testing.T) {
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagApppluginsHandleProxyRequests: setting.NewInMemoryFlag(featuremgmt.FlagApppluginsHandleProxyRequests, true),
	})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	for _, tc := range []struct {
		name           string
		config         map[string]setting.UnifiedStorageConfig
		origin         string
		injectedPolicy bool
	}{
		{name: "default legacy", origin: "cloudconfig"},
		{name: "dual write", config: map[string]setting.UnifiedStorageConfig{"app.example-app": {DualWriterMode: 1}}, origin: "cloudconfig"},
		{name: "unified only", config: map[string]setting.UnifiedStorageConfig{"app.example-app": {DualWriterMode: 5}}, origin: "unified"},
		{name: "wildcard unified", config: map[string]setting.UnifiedStorageConfig{"app.*-app": {DualWriterMode: 5}}, origin: "unified"},
		{name: "explicit legacy overrides wildcard", config: map[string]setting.UnifiedStorageConfig{"app.*-app": {DualWriterMode: 5}, "app.example-app": {DualWriterMode: 0}}, origin: "cloudconfig"},
		{name: "injected migration policy overrides config", config: map[string]setting.UnifiedStorageConfig{"app.example-app": {DualWriterMode: 5}}, origin: "cloudconfig", injectedPolicy: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			listener, err := net.Listen("tcp", "127.0.0.1:0")
			require.NoError(t, err)
			server := grpc.NewServer()
			v2 := &cloudSettingsPluginServer{calls: make(chan *pluginv2.PluginContext, 10), headers: make(chan string, 10)}
			pluginv2.RegisterDiagnosticsServer(server, v2)
			pluginv2.RegisterResourceServer(server, v2)
			go func() { _ = server.Serve(listener) }()
			t.Cleanup(server.Stop)
			proxyPaths := make(chan string, 1)
			proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { proxyPaths <- r.URL.Path }))
			defer proxy.Close()
			deployment := definition.PluginDeployments{Plugins: []definition.PluginDeployment{{Host: listener.Addr().String(), Definition: definition.PluginDefinition{
				JSONData: plugins.JSONData{ID: "example-app", Type: plugins.TypeApp, Routes: []*plugins.Route{{Path: "remote", Method: "GET", ReqAction: "example-app.remote:read", URL: proxy.URL + "/{{.JsonData.origin}}"}}},
			}}}}
			manifest := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _ = json.NewEncoder(w).Encode(deployment) }))
			defer manifest.Close()
			cfg := cfgWithCloudRouterSection(t, map[string]string{"plugins_url": manifest.URL, "app_settings_enabled": "true"})
			cfg.UnifiedStorage = maps.Clone(tc.config)
			legacy := &countingSettingsStore{Storage: appsettings.NewLegacySettingsStore("example-app", "example-app", &pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
				"example-app": {Enabled: true, JSONData: map[string]any{"origin": "cloudconfig"}},
			}})}
			unified := &cloudSettingsResourceClient{}
			clients := RoutesLoaderClients{Resource: unified, LegacyAccess: settingsLegacyCheckFunc(func(context.Context, legacyclient.LegacyCheckRequest) (bool, error) { return true, nil })}
			if tc.injectedPolicy {
				clients.DualWrite = dualwrite.ProvideServiceForTests(nil)
			}
			loader, err := ProvideCloudRoutesLoader(cfg, clients, CloudSettingsDependencies{LegacyStore: func(context.Context, string) (grafanarest.Storage, error) { return legacy, nil }}, tracing.InitializeTracerForTest(), featuremgmt.WithFeatures(), prometheus.NewRegistry())
			require.NoError(t, err)
			cloud := loader.(*cloudLoader)
			defer func() { require.NoError(t, cloud.stopping(nil)) }()
			for _, source := range cloud.sources {
				source.poll(t.Context(), cloud.dirty)
			}
			backends, err := cloud.Load(t.Context())
			require.NoError(t, err)
			require.Len(t, backends, 1)
			h, err := backends[0].Load(t.Context())
			require.NoError(t, err)
			defer h.(interface{ Destroy() }).Destroy()
			serve := func(method, path string) *httptest.ResponseRecorder {
				r := httptest.NewRequest(method, path, strings.NewReader(`{}`))
				r.Header.Set("Content-Type", "application/json")
				user := settingsRequester("stacks-1")
				user.AccessTokenClaims.Rest.DelegatedPermissions = []string{"*-app:*"}
				r = r.WithContext(identity.WithRequester(r.Context(), user))
				w := httptest.NewRecorder()
				h.ServeHTTP(newStatusRecorder(w).writer(), r)
				return w
			}
			root := "/apis/example-app/v0alpha1"
			list := root + "/namespaces/stacks-1/app"
			item := list + "/instance"
			for _, path := range []string{item, list} {
				res := serve("GET", path)
				require.Equal(t, 200, res.Code, res.Body.String())
				require.Contains(t, res.Body.String(), `"origin":"`+tc.origin+`"`)
				require.Contains(t, res.Body.String(), `"name":"instance"`)
			}
			for _, sub := range []string{"health", "resources"} {
				res := serve("GET", item+"/"+sub)
				require.Equal(t, 200, res.Code, res.Body.String())
				call := <-v2.calls
				require.Equal(t, "stacks-1", call.Namespace)
				require.JSONEq(t, fmt.Sprintf(`{"origin":%q}`, tc.origin), string(call.AppInstanceSettings.JsonData))
			}
			res := serve("GET", item+"/proxy/remote")
			require.Equal(t, 200, res.Code, res.Body.String())
			require.Equal(t, "/"+tc.origin, <-proxyPaths)
			for _, method := range []string{"POST", "PUT", "PATCH", "DELETE"} {
				path := item
				if method == "POST" {
					path = list
				}
				res := serve(method, path+"?dryRun=All")
				require.GreaterOrEqual(t, res.Code, 400)
				require.Less(t, res.Code, 500)
			}
			res = serve("GET", list+"?watch=true")
			require.GreaterOrEqual(t, res.Code, 400)
			require.Less(t, res.Code, 500)
			res = serve("GET", root)
			require.Equal(t, 200, res.Code, res.Body.String())
			var discovery metav1.APIResourceList
			require.NoError(t, json.Unmarshal(res.Body.Bytes(), &discovery))
			require.Len(t, discovery.APIResources, 1)
			require.ElementsMatch(t, []string{"get", "list"}, discovery.APIResources[0].Verbs)
			if tc.origin == "unified" {
				require.Zero(t, legacy.reads.Load(), "unified-only requests must not read cloudconfig")
				require.Positive(t, unified.reads.Load())
			} else {
				require.Positive(t, legacy.reads.Load())
			}
			require.Equal(t, tc.config, cfg.UnifiedStorage, "discovered plugins must not mutate shared config")
		})
	}
}

type countingSettingsStore struct {
	grafanarest.Storage
	reads atomic.Int64
}

func (s *countingSettingsStore) Get(ctx context.Context, name string, opts *metav1.GetOptions) (runtime.Object, error) {
	s.reads.Add(1)
	return s.Storage.Get(ctx, name, opts)
}
func (s *countingSettingsStore) List(ctx context.Context, opts *metainternal.ListOptions) (runtime.Object, error) {
	s.reads.Add(1)
	return s.Storage.List(ctx, opts)
}

// Only reads are implemented: an unexpected write or watch fails the test.
type cloudSettingsResourceClient struct {
	resource.ResourceClient
	reads atomic.Int64
}

func (c *cloudSettingsResourceClient) value(key *resourcepb.ResourceKey) ([]byte, error) {
	if key.Group != appv0.GROUP || key.Resource != appv0.APP_RESOURCE_NAME || key.Namespace != "stacks-1" {
		return nil, fmt.Errorf("unexpected shared storage key: %v", key)
	}
	c.reads.Add(1)
	return []byte(`{"apiVersion":"plugins.grafana.app/v0alpha1","kind":"Settings","metadata":{"namespace":"stacks-1","name":"example-app","resourceVersion":"1"},"spec":{"enabled":true,"jsonData":{"origin":"unified"}}}`), nil
}
func (c *cloudSettingsResourceClient) Read(_ context.Context, req *resourcepb.ReadRequest, _ ...grpc.CallOption) (*resourcepb.ReadResponse, error) {
	if req.Key.Name != "example-app" {
		return nil, fmt.Errorf("unexpected stored name %q", req.Key.Name)
	}
	value, err := c.value(req.Key)
	return &resourcepb.ReadResponse{ResourceVersion: 1, Value: value}, err
}
func (c *cloudSettingsResourceClient) List(_ context.Context, req *resourcepb.ListRequest, _ ...grpc.CallOption) (*resourcepb.ListResponse, error) {
	value, err := c.value(req.Options.Key)
	return &resourcepb.ListResponse{ResourceVersion: 1, Items: []*resourcepb.ResourceWrapper{{ResourceVersion: 1, Value: value}}}, err
}
