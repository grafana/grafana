package router

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	appv0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestSTAppSettingsFeatureFlags(t *testing.T) {
	for _, tc := range []struct {
		name            string
		settings, proxy bool
	}{
		{name: "settings disabled"},
		{name: "settings enabled", settings: true},
		{name: "settings and proxy enabled", settings: true, proxy: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			featuremgmt.WithFlagValues(t, map[string]any{
				featuremgmt.FlagApppluginsRegisterAPIServer:   tc.settings,
				featuremgmt.FlagApppluginsHandleProxyRequests: tc.proxy,
			})
			proxyPaths := make(chan string, 1)
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				proxyPaths <- r.URL.Path
				w.WriteHeader(http.StatusOK)
			}))
			defer upstream.Close()
			bundle := &plugins.FoundBundle{Primary: plugins.FoundPlugin{
				JSONData: plugins.JSONData{ID: "example-app", Type: plugins.TypeApp, Routes: []*plugins.Route{{
					Path: "remote", Method: "GET", URL: upstream.URL + "/{{.JsonData.origin}}/{{.SecureJsonData.token}}", ReqAction: "example-app.remote:read",
				}}}, FS: plugins.NewFakeFS(),
			}}
			sources := &pluginfakes.FakeSourceRegistry{ListFunc: func(context.Context) []plugins.PluginSource {
				return []plugins.PluginSource{&pluginfakes.FakePluginSource{DiscoverFunc: func(context.Context) ([]*plugins.FoundBundle, error) {
					return []*plugins.FoundBundle{bundle}, nil
				}}}
			}}
			settings := &stCompatibilitySettings{FakePluginSettings: &pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
				"example-app": {Enabled: true, Pinned: true, JSONData: map[string]any{"origin": "local"}, SecureJSONData: map[string][]byte{"token": []byte("encrypted")}},
			}}}
			calls := make(chan backend.PluginContext, 2)
			client := &backend.Handlers{
				CheckHealthHandler: backend.CheckHealthHandlerFunc(func(_ context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
					calls <- req.PluginContext
					return &backend.CheckHealthResult{Status: backend.HealthStatusOk}, nil
				}),
				CallResourceHandler: backend.CallResourceHandlerFunc(func(_ context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
					calls <- req.PluginContext
					return sender.Send(&backend.CallResourceResponse{Status: http.StatusOK, Body: []byte(req.Path)})
				}),
			}
			cfg := setting.NewCfg()
			ac := &actest.FakeAccessControl{ExpectedEvaluate: true}
			features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware)
			deps := ProvidePluginLoaderDependencies(client, stCompatibilityContext{}, nil, sources, settings, nil, ac,
				&resource.MockResourceClient{}, nil, nil, nil, features, cfg, dualwrite.ProvideServiceForTests(cfg), nil, nil, nil, nil, nil)
			loader, err := ProvideRoutesLoader(cfg, deps, nil)
			require.NoError(t, err)
			backends, err := loader.Load(t.Context())
			require.NoError(t, err)
			if !tc.settings {
				require.Empty(t, backends)
				return
			}
			require.Len(t, backends, 1)
			h, err := backends[0].Load(t.Context())
			require.NoError(t, err)
			defer h.(interface{ Destroy() }).Destroy()
			user := &identity.StaticRequester{Type: types.TypeUser, Namespace: "default", OrgID: 1, UserUID: "reader"}
			serve := func(method, path, body string) *httptest.ResponseRecorder {
				r := httptest.NewRequest(method, path, strings.NewReader(body))
				r.Header.Set("Content-Type", "application/json")
				r = r.WithContext(identity.WithRequester(r.Context(), user))
				w := httptest.NewRecorder()
				h.ServeHTTP(newStatusRecorder(w).writer(), r)
				return w
			}
			root := "/apis/example-app/v0alpha1"
			item := root + "/namespaces/default/app/instance"
			res := serve("GET", item, "")
			require.Equal(t, http.StatusOK, res.Code, res.Body.String())
			require.NotContains(t, res.Body.String(), "local-secret")
			var obj appv0.Settings
			require.NoError(t, json.Unmarshal(res.Body.Bytes(), &obj))
			require.True(t, obj.Spec.Pinned)
			for _, sub := range []string{"health", "resources/example"} {
				res = serve("GET", item+"/"+sub, "")
				require.Equal(t, http.StatusOK, res.Code, res.Body.String())
				call := <-calls
				require.Equal(t, "st-context", call.Namespace, "the ST context provider is retained")
				require.Equal(t, "example-app", call.PluginID)
				require.JSONEq(t, `{"origin":"local"}`, string(call.AppInstanceSettings.JSONData))
				require.Equal(t, "local-secret", call.AppInstanceSettings.DecryptedSecureJSONData["token"])
			}
			res = serve("GET", item+"/proxy/remote", "")
			if tc.proxy {
				require.Equal(t, http.StatusOK, res.Code, res.Body.String())
				require.Equal(t, "/local/local-secret", <-proxyPaths)
			} else {
				require.Equal(t, http.StatusNotFound, res.Code, res.Body.String())
				require.Empty(t, proxyPaths)
			}
			obj.Spec.JsonData.Object["origin"] = "updated"
			body, err := json.Marshal(obj)
			require.NoError(t, err)
			res = serve("PUT", item+"?dryRun=All", string(body))
			require.Equal(t, http.StatusOK, res.Code, res.Body.String())
			require.Equal(t, "local", settings.Plugins["example-app"].JSONData["origin"])
			res = serve("PUT", item, string(body))
			require.Equal(t, http.StatusOK, res.Code, res.Body.String())
			require.Equal(t, "updated", settings.Plugins["example-app"].JSONData["origin"])
			res = serve("GET", root, "")
			require.Equal(t, http.StatusOK, res.Code, res.Body.String())
			var discovery metav1.APIResourceList
			require.NoError(t, json.Unmarshal(res.Body.Bytes(), &discovery))
			require.Len(t, discovery.APIResources, 1)
			require.Contains(t, discovery.APIResources[0].Verbs, "update", "MT read-only discovery must not affect ST")
			ac.ExpectedEvaluate = false
			for _, method := range []string{"GET", "PUT"} {
				res = serve(method, item, string(body))
				require.Equal(t, http.StatusForbidden, res.Code, res.Body.String())
			}
			ac.ExpectedEvaluate = true
			settings.Plugins["example-app"].Enabled = false
			res = serve("GET", item+"/health", "")
			require.Equal(t, http.StatusBadRequest, res.Code, res.Body.String())
			require.Empty(t, calls)
		})
	}
}

type stCompatibilitySettings struct {
	*pluginsettings.FakePluginSettings
}

func (*stCompatibilitySettings) DecryptedValues(*pluginsettings.DTO) map[string]string {
	return map[string]string{"token": "local-secret"}
}

type stCompatibilityContext struct{}

func (stCompatibilityContext) PluginContextForApp(ctx context.Context, id string, settings *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error) {
	return ctx, backend.PluginContext{Namespace: "st-context", PluginID: id, AppInstanceSettings: settings}, nil
}
