package router

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/appsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestPluginSettingsStoreProvider(t *testing.T) {
	for _, local := range []bool{true, false} {
		name := "injected store"
		if local {
			name = "local SQL adapter"
		}
		t.Run(name, func(t *testing.T) {
			settings := &pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
				"example-app": {Enabled: true, Pinned: true, JSONData: map[string]any{"endpoint": "before"}},
				"other-app":   {Enabled: true, JSONData: map[string]any{"endpoint": "other"}},
			}}
			cfg := setting.NewCfg()
			dw := dualwrite.ProvideServiceForTests(cfg)
			deps := PluginDependencies{Cfg: cfg, DualWrite: dw}
			if local {
				deps = ProvidePluginLoaderDependencies(nil, nil, nil, nil, settings, nil, nil,
					nil, nil, nil, nil, nil, cfg, dw, nil, nil, nil, nil, nil).PluginDependencies
			} else {
				deps.Settings.LegacyStore = func(_ context.Context, id string) (grafanarest.Storage, error) {
					return appsettings.NewLegacySettingsStore(id, id, settings), nil
				}
			}
			deps.ContextProvider = struct {
				appsettings.PluginContextWrapper
			}{}
			deps.Unified = &resource.MockResourceClient{}
			deps.AccessControl = &actest.FakeAccessControl{ExpectedEvaluate: true}
			client := func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
				return struct{ plugins.Client }{}, nil, nil
			}
			for _, id := range []string{"example-app", "other-app"} {
				backend, err := newPluginSettingsBackend(definition.PluginDefinition{
					JSONData: plugins.JSONData{ID: id, Type: plugins.TypeApp},
				}, client, deps)
				require.NoError(t, err)
				handler, err := backend.Load(t.Context())
				require.NoError(t, err)
				t.Cleanup(handler.(interface{ Destroy() }).Destroy)

				serve := func(method string, body []byte) *httptest.ResponseRecorder {
					req := httptest.NewRequest(method, "/apis/"+id+"/v0alpha1/namespaces/default/app/instance", bytes.NewReader(body))
					req.Header.Set("Content-Type", "application/json")
					req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{
						Type: claims.TypeUser, OrgID: 1, Namespace: "default",
					}))
					res := httptest.NewRecorder()
					handler.ServeHTTP(res, req)
					return res
				}
				res := serve(http.MethodGet, nil)
				require.Equal(t, http.StatusOK, res.Code, res.Body.String())
				var got apppluginV0.Settings
				require.NoError(t, json.Unmarshal(res.Body.Bytes(), &got))
				require.Equal(t, settings.Plugins[id].JSONData, got.Spec.JsonData.Object)
				require.Equal(t, settings.Plugins[id].Pinned, got.Spec.Pinned)

				got.Spec.JsonData.Object["endpoint"] = id + "-updated"
				body, err := json.Marshal(got)
				require.NoError(t, err)
				res = serve(http.MethodPut, body)
				require.Equal(t, http.StatusOK, res.Code, res.Body.String())
				require.Equal(t, id+"-updated", settings.Plugins[id].JSONData["endpoint"])
			}
			require.Equal(t, "example-app-updated", settings.Plugins["example-app"].JSONData["endpoint"])
		})
	}
}

func TestPluginSettingsStoreProviderFailure(t *testing.T) {
	wantErr := errors.New("legacy settings unavailable")
	for _, tc := range []struct {
		name string
		err  error
		want string
	}{
		{"error", wantErr, "legacy settings unavailable"},
		{"nil store", nil, "legacy settings store provider returned no store"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend, err := newPluginSettingsBackend(definition.PluginDefinition{
				JSONData: plugins.JSONData{ID: "example-app", Type: plugins.TypeApp},
			}, func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
				return struct{ plugins.Client }{}, nil, nil
			}, PluginDependencies{Settings: SettingsDependencies{
				LegacyStore: func(ctx context.Context, id string) (grafanarest.Storage, error) {
					require.Equal(t, "example-app", id)
					return nil, tc.err
				},
			}})
			require.NoError(t, err)
			_, err = backend.Load(t.Context())
			require.ErrorContains(t, err, tc.want)
			if tc.err != nil {
				require.ErrorIs(t, err, tc.err)
			}
		})
	}
}
