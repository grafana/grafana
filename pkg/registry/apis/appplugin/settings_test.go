package appplugin

import (
	"context"
	"encoding/json"
	"path"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/pluginassets/modulehash"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginassets"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"

	apppluginv0alpha1 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
)

func TestSettingsGet_InvalidName(t *testing.T) {
	gr := schema.GroupResource{Group: "appplugin.grafana.app", Resource: "settings"}
	storage := &settingsStorage{
		pluginID: "test-app",
		resource: gr,
	}

	ctx := request.WithNamespace(context.Background(), "default")
	obj, err := storage.Get(ctx, "not-current", nil)
	require.Nil(t, obj)
	require.Error(t, err)
	require.True(t, apierrors.IsNotFound(err))
}

// TestSettingsGet_JSONMatchesLegacyEndpoint tests that the JSON matches the legacy endpoint.
func TestSettingsGet_JSONMatchesLegacyEndpoint(t *testing.T) {
	cfg := &setting.Cfg{AppSubURL: "/grafana"}
	pAssets := pluginassets.ProvideService(
		modulehash.NewCalculator(&config.PluginManagementCfg{}, registry.NewInMemory(), nil, nil),
	)
	plugin := testPlugin()

	tests := []struct {
		name          string
		pluginSetting *pluginsettings.DTO
		updateChecker pluginUpdateChecker
		hasUpdate     bool
		latestVersion string
	}{
		{
			name:          "defaults with no persisted settings",
			pluginSetting: nil,
			hasUpdate:     false,
			latestVersion: "",
		},
		{
			name: "with persisted settings overriding enabled/pinned and jsonData",
			pluginSetting: &pluginsettings.DTO{
				PluginID: "test-app",
				OrgID:    1,
				Enabled:  false,
				Pinned:   true,
				JSONData: map[string]any{"apiUrl": "https://api.example.com", "timeout": float64(30)},
				SecureJSONData: map[string][]byte{
					"apiKey": []byte("secret-key"),
				},
			},
			hasUpdate:     false,
			latestVersion: "",
		},
		{
			name: "with persisted settings and empty jsonData",
			pluginSetting: &pluginsettings.DTO{
				PluginID: "test-app",
				OrgID:    1,
				Enabled:  true,
				Pinned:   false,
				JSONData: map[string]any{},
			},
			hasUpdate:     false,
			latestVersion: "",
		},
		{
			name:          "with available update",
			pluginSetting: nil,
			updateChecker: &fakeUpdateChecker{updates: map[string]string{"test-app": "1.2.4"}},
			hasUpdate:     true,
			latestVersion: "1.2.4",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fakeSettings := &pluginsettings.FakePluginSettings{
				Plugins: map[string]*pluginsettings.DTO{},
			}
			if tt.pluginSetting != nil {
				fakeSettings.Plugins[plugin.ID] = tt.pluginSetting
			}

			store := pluginstore.NewFakePluginStore(plugin)

			storage := &settingsStorage{
				pluginID:             plugin.ID,
				pluginStore:          store,
				pluginSettings:       fakeSettings,
				pluginsUpdateChecker: tt.updateChecker,
				pluginAssets:         pAssets,
				cfg:                  cfg,
			}

			ctx := request.WithNamespace(context.Background(), "default")

			obj, err := storage.Get(ctx, "current", nil)
			require.NoError(t, err)

			settings := obj.(*apppluginv0alpha1.Settings)
			specJSON, err := json.Marshal(settings.Spec)
			require.NoError(t, err)

			legacyDTO := buildLegacyDTO(plugin, cfg, tt.pluginSetting, tt.hasUpdate, tt.latestVersion)
			legacyJSON, err := json.Marshal(legacyDTO)
			require.NoError(t, err)

			var specMap map[string]any
			var legacyMap map[string]any
			require.NoError(t, json.Unmarshal(specJSON, &specMap))
			require.NoError(t, json.Unmarshal(legacyJSON, &legacyMap))

			require.Equal(t, legacyMap, specMap)
		})
	}
}

func testPlugin() pluginstore.Plugin {
	return pluginstore.Plugin{
		JSONData: plugins.JSONData{
			ID:          "test-app",
			Type:        plugins.TypeApp,
			Name:        "Test App",
			AutoEnabled: true,
			Info: plugins.Info{
				Author:      plugins.InfoLink{Name: "Test Author", URL: "https://example.com/author"},
				Description: "A test app plugin",
				Links: []plugins.InfoLink{
					{Name: "Website", URL: "https://example.com"},
					{Name: "License", URL: "https://example.com/license"},
				},
				Logos: plugins.Logos{Small: "public/img/small.png", Large: "public/img/large.png"},
				Build: plugins.BuildInfo{Time: 1234567890},
				Screenshots: []plugins.Screenshots{
					{Name: "screenshot1", Path: "public/img/ss1.png"},
				},
				Version:  "1.2.3",
				Updated:  "2025-01-15",
				Keywords: []string{"test", "app"},
			},
			Includes: []*plugins.Includes{
				{
					Name:       "Dashboard",
					Path:       "dashboards/overview.json",
					Type:       "dashboard",
					Component:  "",
					Role:       "Viewer",
					Action:     "plugins.app:access",
					AddToNav:   true,
					DefaultNav: true,
					Slug:       "overview",
					Icon:       "icon-dashboard",
					UID:        "include-uid-1",
				},
			},
			Dependencies: plugins.Dependencies{
				GrafanaDependency: ">=10.0.0",
				GrafanaVersion:    "10.0.0",
				Plugins: []plugins.Dependency{
					{ID: "dep-datasource", Type: "datasource", Name: "Dep DS"},
				},
				Extensions: plugins.ExtensionsDependencies{
					ExposedComponents: []string{"myOrg-myApp-app/component/v1"},
				},
			},
			Extensions: plugins.Extensions{
				AddedLinks: []plugins.AddedLink{
					{Targets: []string{"grafana/dashboard/panel/menu"}, Title: "My Link", Description: "A link"},
				},
				AddedComponents: []plugins.AddedComponent{
					{Targets: []string{"grafana/dashboard/panel/menu"}, Title: "My Component", Description: "A component"},
				},
				ExposedComponents: []plugins.ExposedComponent{
					{Id: "myOrg-myApp-app/component/v1", Title: "My Exposed", Description: "An exposed component"},
				},
				ExtensionPoints: []plugins.ExtensionPoint{
					{Id: "myOrg-myApp-app/ep/v1", Title: "My EP", Description: "An extension point"},
				},
				AddedFunctions: []plugins.AddedFunction{
					{Targets: []string{"grafana/alerting/rule-action"}, Title: "My Function", Description: "A function"},
				},
			},
			State: plugins.ReleaseStateAlpha,
		},
		Signature:       plugins.SignatureStatusValid,
		SignatureType:   plugins.SignatureTypeGrafana,
		SignatureOrg:    "grafana",
		Module:          "public/plugins/test-app/module.js",
		BaseURL:         "public/plugins/test-app",
		DefaultNavURL:   "/plugins/test-app/",
		Angular:         plugins.AngularMeta{Detected: false},
		LoadingStrategy: plugins.LoadingStrategyScript,
		Translations:    map[string]string{"en": "public/locales/en.json"},
	}
}

// buildLegacyDTO replicates the logic in pkg/api/plugins.go GetPluginSettingByID
// for building the legacy DTO, skipping auth checks, pluginErrorResolver, and update checker.
func buildLegacyDTO(
	plugin pluginstore.Plugin,
	cfg *setting.Cfg,
	ps *pluginsettings.DTO,
	hasUpdate bool,
	latestVersion string,
) *dtos.PluginSetting {
	dto := &dtos.PluginSetting{
		Type:             string(plugin.Type),
		Id:               plugin.ID,
		Name:             plugin.Name,
		Info:             plugin.Info,
		Dependencies:     plugin.Dependencies,
		Includes:         plugin.Includes,
		BaseUrl:          plugin.BaseURL,
		Module:           plugin.Module,
		DefaultNavUrl:    path.Join(cfg.AppSubURL, plugin.DefaultNavURL),
		State:            plugin.State,
		Signature:        plugin.Signature,
		SignatureType:    plugin.SignatureType,
		SignatureOrg:     plugin.SignatureOrg,
		SecureJsonFields: map[string]bool{},
		AngularDetected:  plugin.Angular.Detected,
		LoadingStrategy:  plugin.LoadingStrategy,
		Extensions:       plugin.Extensions,
		Translations:     plugin.Translations,
		LatestVersion:    latestVersion,
		HasUpdate:        hasUpdate,
	}

	if plugin.IsApp() {
		dto.Enabled = plugin.AutoEnabled
		dto.Pinned = plugin.AutoEnabled
		dto.AutoEnabled = plugin.AutoEnabled
	}

	if ps != nil {
		dto.Enabled = ps.Enabled
		dto.Pinned = ps.Pinned
		dto.JsonData = ps.JSONData
		for k, v := range ps.SecureJSONData {
			if len(v) > 0 {
				dto.SecureJsonFields[k] = true
			}
		}
	}

	return dto
}

type fakeUpdateChecker struct {
	updates map[string]string
}

func (f *fakeUpdateChecker) HasUpdate(_ context.Context, pluginID string) (string, bool) {
	v, ok := f.updates[pluginID]
	return v, ok
}
