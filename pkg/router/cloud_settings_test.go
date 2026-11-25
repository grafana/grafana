package router

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	appv0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/appsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type settingsLegacyCheckFunc func(context.Context, legacyclient.LegacyCheckRequest) (bool, error)

func (f settingsLegacyCheckFunc) LegacyCheck(ctx context.Context, req legacyclient.LegacyCheckRequest) (bool, error) {
	return f(ctx, req)
}

func settingsRequester(ns string) *identity.StaticRequester {
	return &identity.StaticRequester{Type: types.TypeUser, UserUID: "reader", Namespace: ns, OrgID: 1, IDToken: "id-" + ns,
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{DelegatedPermissions: []string{"*-app:get"}}},
	}
}

func TestCloudSettingsRoutes(t *testing.T) {
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagApppluginsHandleProxyRequests: setting.NewInMemoryFlag(featuremgmt.FlagApppluginsHandleProxyRequests, true),
	})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
	for _, withFallback := range []bool{false, true} {
		t.Run(map[bool]string{false: "settings only", true: "supersedes v2 HTTP backend"}[withFallback], func(t *testing.T) {
			listener, err := net.Listen("tcp", "127.0.0.1:0")
			require.NoError(t, err)
			server := grpc.NewServer()
			v2 := &cloudSettingsPluginServer{calls: make(chan *pluginv2.PluginContext, 10), headers: make(chan string, 10)}
			pluginv2.RegisterDiagnosticsServer(server, v2)
			pluginv2.RegisterResourceServer(server, v2)
			go func() { _ = server.Serve(listener) }()
			t.Cleanup(server.Stop)
			proxyCalls := make(chan *http.Request, 10)
			proxyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				proxyCalls <- r
				w.WriteHeader(200)
			}))
			defer proxyServer.Close()
			deployment := definition.PluginDeployments{Plugins: []definition.PluginDeployment{{Host: listener.Addr().String(), Definition: definition.PluginDefinition{
				JSONData: plugins.JSONData{ID: "example-app", Type: plugins.TypeApp, Routes: []*plugins.Route{{
					Path: "remote", Method: "GET", URL: proxyServer.URL + "/{{.JsonData.origin}}/{{.SecureJsonData.token}}", ReqAction: "example-app.remote:read",
				}}},
			}}}}
			manifestServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				require.NoError(t, json.NewEncoder(w).Encode(deployment))
			}))
			defer manifestServer.Close()
			var fallbackCalls []string
			fallbackServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/apis" {
					require.NoError(t, json.NewEncoder(w).Encode(metav1.APIGroupList{Groups: []metav1.APIGroup{{Name: "example-app", Versions: []metav1.GroupVersionForDiscovery{{Version: "v0alpha1", GroupVersion: "example-app/v0alpha1"}}}}}))
					return
				}
				fallbackCalls = append(fallbackCalls, r.Method+" "+r.URL.Path)
				w.WriteHeader(http.StatusAccepted)
			}))
			defer fallbackServer.Close()
			cfg := cfgWithCloudRouterSection(t, map[string]string{"plugins_url": manifestServer.URL, "app_settings_enabled": "true"})
			if withFallback {
				addAggregateSection(t, cfg, "v2", map[string]string{"url": fallbackServer.URL, "discovery_auth": "none"})
			}
			var checks []legacyclient.LegacyCheckRequest
			allowed := true
			routeAllowed := true
			checkErr := error(nil)
			legacy := settingsLegacyCheckFunc(func(_ context.Context, req legacyclient.LegacyCheckRequest) (bool, error) {
				checks = append(checks, req)
				permissions := map[string][]string{pluginaccesscontrol.ActionAppAccess: {"plugins:id:example-app"}}
				if routeAllowed {
					permissions["example-app.remote:read"] = []string{"plugins:id:example-app"}
				}
				return allowed && req.Evaluator.Evaluate(permissions), checkErr
			})
			settings := &cloudSettingsTestService{FakePluginSettings: &pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{"example-app": {Enabled: true, Pinned: true, JSONData: map[string]any{"origin": "cloudconfig"}, SecureJSONData: map[string][]byte{"token": []byte("encrypted")}}}}}
			factoryCalls := 0
			provider := func(_ context.Context, id string) (grafanarest.Storage, error) {
				factoryCalls++
				return appsettings.NewLegacySettingsStore(id, id, settings), nil
			}
			loader, err := ProvideCloudRoutesLoader(cfg, RoutesLoaderClients{Resource: &resource.MockResourceClient{}, LegacyAccess: legacy}, CloudSettingsDependencies{LegacyStore: provider}, tracing.InitializeTracerForTest(), featuremgmt.WithFeatures(), prometheus.NewRegistry())
			require.NoError(t, err)
			cloud := loader.(*cloudLoader)
			defer func() { require.NoError(t, cloud.stopping(nil)) }()
			for _, source := range cloud.sources {
				source.poll(t.Context(), cloud.dirty)
			}
			backends, err := cloud.Load(t.Context())
			require.NoError(t, err)
			require.Len(t, backends, 1)
			b := backends[0].(*PluginBackend)
			require.Equal(t, "example-app", b.Group().Name)
			deployment.Plugins = append(deployment.Plugins, deployment.Plugins[0])
			pluginManifestsTargetOf(cloud, sourcePlugins).poll(t.Context(), cloud.dirty)
			duplicates, err := cloud.Load(t.Context())
			require.NoError(t, err)
			require.Len(t, duplicates, 1)
			require.Equal(t, b.Key(), duplicates[0].Key(), "duplicate plugin entries must retain the same deployment")
			require.Nil(t, pluginManifestsTargetOf(cloud, sourcePlugins).connections)
			h, err := b.Load(t.Context())
			require.NoError(t, err)
			t.Cleanup(h.(interface{ Destroy() }).Destroy)
			require.Equal(t, 1, factoryCalls)
			serve := func(method, path string, user *identity.StaticRequester) *httptest.ResponseRecorder {
				r := httptest.NewRequest(method, path, strings.NewReader(`{}`))
				r.Header.Set("Content-Type", "application/json")
				if user != nil {
					r = r.WithContext(identity.WithRequester(r.Context(), user))
				}
				w := httptest.NewRecorder()
				h.ServeHTTP(newStatusRecorder(w).writer(), r)
				return w
			}
			root := "/apis/example-app/v0alpha1"
			item := root + "/namespaces/stacks-1/app/instance"
			for _, ns := range []string{"stacks-1", "stacks-2"} {
				res := serve("GET", root+"/namespaces/"+ns+"/app/instance", settingsRequester(ns))
				require.Equal(t, 200, res.Code, res.Body.String())
				var obj appv0.Settings
				require.NoError(t, json.Unmarshal(res.Body.Bytes(), &obj))
				require.Equal(t, ns, obj.Namespace)
				require.True(t, obj.Spec.Pinned)
				require.NotContains(t, res.Body.String(), "read-secret")
				last := checks[len(checks)-1]
				require.Equal(t, ns, last.Namespace)
				require.Equal(t, "user:reader", last.Subject)
				require.NotNil(t, last.RequesterOrgID)
				ok := last.Evaluator.Evaluate(map[string][]string{pluginaccesscontrol.ActionAppAccess: {"plugins:id:example-app"}})
				require.True(t, ok)
			}
			res := serve("GET", root+"/namespaces/stacks-1/app", settingsRequester("stacks-1"))
			require.Equal(t, 200, res.Code, res.Body.String())
			for _, method := range []string{"POST", "PUT", "PATCH", "DELETE"} {
				res := serve(method, item+"?dryRun=All", settingsRequester("stacks-1"))
				require.GreaterOrEqual(t, res.Code, 400)
				require.Less(t, res.Code, 500)
			}
			require.Empty(t, fallbackCalls)
			allowed = false
			require.Equal(t, 403, serve("GET", item, settingsRequester("stacks-1")).Code)
			allowed = true
			checkErr = errors.New("authz unavailable")
			require.Equal(t, 500, serve("GET", item, settingsRequester("stacks-1")).Code)
			checkErr = nil
			require.Equal(t, 403, serve("GET", item, settingsRequester("stacks-2")).Code)
			require.Equal(t, 401, serve("GET", item, nil).Code)
			user := settingsRequester("stacks-1")
			user.AccessTokenClaims = nil
			require.Equal(t, 403, serve("GET", item, user).Code)
			user = &identity.StaticRequester{Type: types.TypeAccessPolicy, Namespace: "*", AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{Permissions: []string{"*-app:get"}}}}
			require.Equal(t, 200, serve("GET", item, user).Code)
			user.AccessTokenClaims.Rest.Permissions = nil
			require.Equal(t, 403, serve("GET", item, user).Code)
			res = serve("GET", root, settingsRequester("stacks-1"))
			require.Equal(t, 200, res.Code, res.Body.String())
			var resources metav1.APIResourceList
			require.NoError(t, json.Unmarshal(res.Body.Bytes(), &resources))
			require.Len(t, resources.APIResources, 1)
			require.ElementsMatch(t, []string{"get", "list"}, resources.APIResources[0].Verbs)
			res = serve("GET", "/openapi/v3/apis/example-app/v0alpha1", settingsRequester("stacks-1"))
			require.Equal(t, 200, res.Code, res.Body.String())
			var doc spec3.OpenAPI
			require.NoError(t, json.Unmarshal(res.Body.Bytes(), &doc))
			path := root + "/namespaces/{namespace}/app/{name}"
			require.NotNil(t, doc.Paths.Paths[path])
			require.NotNil(t, doc.Paths.Paths[path].Get)
			require.Nil(t, doc.Paths.Paths[path].Put)
			require.Nil(t, doc.Paths.Paths[path].Delete)
			for _, ns := range []string{"stacks-1", "stacks-2"} {
				for _, sub := range []string{"health", "resources"} {
					res = serve("GET", root+"/namespaces/"+ns+"/app/instance/"+sub, settingsRequester(ns))
					require.Equal(t, 200, res.Code, res.Body.String())
					call := <-v2.calls
					require.Equal(t, ns, call.Namespace)
					require.Equal(t, "example-app", call.PluginId)
					require.Empty(t, call.PluginVersion)
					require.Equal(t, "id-"+ns, <-v2.headers)
					require.Equal(t, "read-secret", call.AppInstanceSettings.DecryptedSecureJsonData["token"])
					require.Empty(t, call.GrafanaConfig)
					require.NotNil(t, call.User)
					require.JSONEq(t, `{"origin":"cloudconfig"}`, string(call.AppInstanceSettings.JsonData))
				}
			}
			require.Equal(t, 403, serve("POST", item+"/resources", settingsRequester("stacks-1")).Code)
			writer := settingsRequester("stacks-1")
			writer.AccessTokenClaims.Rest.DelegatedPermissions = append(writer.AccessTokenClaims.Rest.DelegatedPermissions, "example-app:create")
			res = serve("POST", item+"/resources", writer)
			require.Equal(t, 200, res.Code, res.Body.String())
			require.Equal(t, "stacks-1", (<-v2.calls).Namespace)
			require.Equal(t, "id-stacks-1", <-v2.headers)
			require.NotNil(t, doc.Paths.Paths[path+"/health"])
			res = serve("GET", item+"/proxy/remote", settingsRequester("stacks-1"))
			require.Equal(t, 200, res.Code, res.Body.String())
			proxied := <-proxyCalls
			require.Equal(t, "/cloudconfig/read-secret", proxied.URL.Path)
			require.Equal(t, "id-stacks-1", proxied.Header.Get("X-Grafana-Id"))
			last := checks[len(checks)-1]
			require.Equal(t, "stacks-1", last.Namespace)
			require.True(t, last.Evaluator.Evaluate(map[string][]string{"example-app.remote:read": {"plugins:id:example-app"}}))
			routeAllowed = false
			require.Equal(t, 403, serve("GET", item+"/proxy/remote", settingsRequester("stacks-1")).Code)
			require.Empty(t, proxyCalls)
			routeAllowed = true
			require.Empty(t, fallbackCalls, "all endpoints are served by the shared handler")
			allowed = false
			require.Equal(t, 403, serve("GET", item+"/health", settingsRequester("stacks-1")).Code)
			require.Empty(t, v2.calls)
			allowed = true
			settings.Plugins["example-app"].Enabled = false
			require.Equal(t, 400, serve("GET", item+"/health", settingsRequester("stacks-1")).Code)
			require.Empty(t, v2.calls)
		})
	}
}

func TestCloudSettingsEnablementRequiresDependencies(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{"plugins_url": "https://plugins.invalid", "app_settings_enabled": "true"})
	_, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
	require.ErrorContains(t, err, "legacy settings provider")
}

type settingsDestroyStore struct {
	grafanarest.Storage
	destroyed int
}

func (s *settingsDestroyStore) Destroy() { s.destroyed++ }

type cloudSettingsPluginServer struct {
	pluginv2.UnimplementedDiagnosticsServer
	pluginv2.UnimplementedResourceServer
	calls   chan *pluginv2.PluginContext
	headers chan string
}

func (s *cloudSettingsPluginServer) CheckHealth(_ context.Context, req *pluginv2.CheckHealthRequest) (*pluginv2.CheckHealthResponse, error) {
	s.calls <- req.PluginContext
	s.headers <- backend.FromProto().CheckHealthRequest(req).GetHTTPHeader("X-Grafana-Id")
	return &pluginv2.CheckHealthResponse{Status: pluginv2.CheckHealthResponse_OK}, nil
}
func (s *cloudSettingsPluginServer) CallResource(req *pluginv2.CallResourceRequest, stream pluginv2.Resource_CallResourceServer) error {
	s.calls <- req.PluginContext
	s.headers <- backend.FromProto().CallResourceRequest(req).GetHTTPHeader("X-Grafana-Id")
	return stream.Send(&pluginv2.CallResourceResponse{Code: 200, Body: []byte(req.Path)})
}

func TestCloudSettingsSourceGateAndFilter(t *testing.T) {
	deployment := definition.PluginDeployments{Plugins: []definition.PluginDeployment{
		{Definition: definition.PluginDefinition{JSONData: plugins.JSONData{ID: "example-app", Type: plugins.TypeApp}}},
		{Definition: definition.PluginDefinition{JSONData: plugins.JSONData{ID: "other-app", Type: plugins.TypeApp}}},
		{Definition: definition.PluginDefinition{JSONData: plugins.JSONData{ID: "data-source", Type: plugins.TypeDataSource}}},
	}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, json.NewEncoder(w).Encode(deployment))
	}))
	defer srv.Close()
	for _, tc := range []struct {
		source  string
		enabled bool
		pattern string
		want    int
	}{
		{sourcePlugins, false, "", 0}, {sourcePlugins, true, "", 2}, {sourceCore, true, "", 0}, {sourceBridge, true, "", 0}, {sourcePlugins, true, "example-app", 1},
	} {
		cfg := setting.NewCfg()
		cfg.Raw.Section(cloudRouterSection).Key("app_settings_enabled").SetValue(map[bool]string{true: "true", false: "false"}[tc.enabled])
		var patterns []string
		if tc.pattern != "" {
			patterns = []string{tc.pattern}
		}
		target, err := newPluginManifestsTarget(tc.source, srv.URL, compileGroupPatterns(patterns), srv.Client(), defaultPluginGRPCConfig(), PluginDependencies{Cfg: cfg})
		require.NoError(t, err)
		backends, skipped, err := target.fetch(t.Context())
		require.NoError(t, err)
		require.Zero(t, skipped)
		require.Len(t, backends, tc.want)
		target.close()
	}
}

type cloudSettingsTestService struct {
	*pluginsettings.FakePluginSettings
}

func (*cloudSettingsTestService) DecryptedValues(*pluginsettings.DTO) map[string]string {
	return map[string]string{"token": "read-secret"}
}

func TestCloudSettingsStoreLifecycle(t *testing.T) {
	for _, fail := range []bool{false, true} {
		t.Run(map[bool]string{false: "retirement", true: "failed load"}[fail], func(t *testing.T) {
			store := &settingsDestroyStore{Storage: appsettings.NewLegacySettingsStore("example-app", "example-app", &pluginsettings.FakePluginSettings{})}
			deps := PluginDependencies{DualWrite: dualwrite.ProvideServiceForTests(nil), ContextProvider: cloudPluginContext{}, Unified: &resource.MockResourceClient{}, Settings: SettingsDependencies{ReadOnly: true, LegacyStore: func(context.Context, string) (grafanarest.Storage, error) { return store, nil }}}
			if fail {
				deps.ContextProvider = nil
			}
			plugin := definition.PluginDefinition{JSONData: plugins.JSONData{ID: "example-app", Type: plugins.TypeApp}}
			loadSettingsManifest(t.Context(), &plugin)
			b, err := newPluginSettingsBackend(plugin, func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
				return struct{ plugins.Client }{}, nil, nil
			}, deps)
			require.NoError(t, err)
			h, err := b.Load(t.Context())
			if fail {
				require.ErrorContains(t, err, "context provider")
			} else {
				require.NoError(t, err)
				require.Zero(t, store.destroyed)
				h.(interface{ Destroy() }).Destroy()
				h.(interface{ Destroy() }).Destroy()
			}
			require.Equal(t, 1, store.destroyed)
		})
	}
}

func TestCloudSettingsBackendStatus(t *testing.T) {
	target, err := newPluginManifestsTarget(sourcePlugins, "http://127.0.0.1:1/plugins", nil, http.DefaultClient, defaultPluginGRPCConfig(), PluginDependencies{})
	require.NoError(t, err)
	t.Cleanup(target.close)
	for _, tc := range []struct {
		host string
		want bool
	}{
		{host: "", want: false},
		{host: "example-app.plugins.svc:10000", want: true},
		// A BaaS HTTP host serves v3 only, and settings use v2.
		{host: "https://example-app.baas.example", want: false},
	} {
		t.Run(tc.host, func(t *testing.T) {
			b, err := target.newSettingsBackend(t.Context(), definition.PluginDeployment{
				Host:       tc.host,
				Definition: definition.PluginDefinition{JSONData: plugins.JSONData{ID: "example-app", Type: plugins.TypeApp}},
			})
			require.NoError(t, err)
			status, ok := b.PluginStatus()
			require.True(t, ok)
			require.Equal(t, tc.want, status.HasBackend)
			require.Equal(t, tc.want, b.acquire != nil)
		})
	}
}
