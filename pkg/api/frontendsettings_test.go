package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social/socialimpl"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/signature/statickey"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	datafakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginassets"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/updatemanager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func setupTestEnvironment(t *testing.T, cfg *setting.Cfg, features featuremgmt.FeatureToggles, pstore pluginstore.Store, psettings pluginsettings.Service, passets *pluginassets.Service) (*web.Mux, *HTTPServer) {
	t.Helper()
	db.InitTestDB(t)
	// nolint:staticcheck
	cfg.IsFeatureToggleEnabled = features.IsEnabledGlobally

	{
		oldVersion := setting.BuildVersion
		oldCommit := setting.BuildCommit
		t.Cleanup(func() {
			setting.BuildVersion = oldVersion
			setting.BuildCommit = oldCommit
		})
	}

	pluginsCfg := &config.PluginManagementCfg{
		PluginsCDNURLTemplate: cfg.PluginsCDNURLTemplate,
		PluginSettings:        cfg.PluginSettings,
	}
	pluginsCDN := pluginscdn.ProvideService(pluginsCfg)

	var pluginStore = pstore
	if pluginStore == nil {
		pluginStore = &pluginstore.FakePluginStore{}
	}

	var pluginsSettings = psettings
	if pluginsSettings == nil {
		pluginsSettings = &pluginsettings.FakePluginSettings{}
	}

	var pluginsAssets = passets
	if pluginsAssets == nil {
		sig := signature.ProvideService(pluginsCfg, statickey.New())
		pluginsAssets = pluginassets.ProvideService(pluginsCfg, pluginsCDN, sig, pluginStore)
	}

	hs := &HTTPServer{
		authnService: &authntest.FakeService{},
		Cfg:          cfg,
		Features:     features,
		License:      &licensing.OSSLicensingService{Cfg: cfg},
		RenderService: &rendering.RenderingService{
			Cfg:                   cfg,
			RendererPluginManager: &fakeRendererPluginManager{},
		},
		SQLStore:              db.InitTestDB(t),
		SettingsProvider:      setting.ProvideProvider(cfg),
		pluginStore:           pluginStore,
		grafanaUpdateChecker:  &updatemanager.GrafanaService{},
		AccessControl:         accesscontrolmock.New(),
		PluginSettings:        pluginsSettings,
		pluginsCDNService:     pluginsCDN,
		pluginAssets:          pluginsAssets,
		namespacer:            request.GetNamespaceMapper(cfg),
		SocialService:         socialimpl.ProvideService(cfg, features, &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService(), remotecache.NewFakeCacheStorage(), nil, ssosettingstests.NewFakeService()),
		managedPluginsService: managedplugins.NewNoop(),
		tracer:                tracing.InitializeTracerForTest(),
		DataSourcesService:    &datafakes.FakeDataSourceService{},
	}

	m := web.New()
	m.Use(getContextHandler(t, cfg).Middleware)
	m.UseMiddleware(web.Renderer(filepath.Join("", "views"), "[[", "]]"))
	m.Get("/api/frontend/settings/", hs.GetFrontendSettings)

	return m, hs
}

func TestIntegrationHTTPServer_GetFrontendSettings_hideVersionAnonymous(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	type buildInfo struct {
		Version string `json:"version"`
		Commit  string `json:"commit"`
		Env     string `json:"env"`
	}
	type settings struct {
		BuildInfo buildInfo `json:"buildInfo"`
	}

	cfg := setting.NewCfg()
	cfg.Env = "testing"
	cfg.BuildVersion = "7.8.9"
	cfg.BuildCommit = "01234567"

	m, hs := setupTestEnvironment(t, cfg, featuremgmt.WithFeatures(), nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/frontend/settings", nil)

	// TODO: Remove
	setting.BuildVersion = cfg.BuildVersion
	setting.BuildCommit = cfg.BuildCommit

	tests := []struct {
		desc        string
		hideVersion bool
		expected    settings
	}{
		{
			desc:        "Not hiding version",
			hideVersion: false,
			expected: settings{
				BuildInfo: buildInfo{
					Version: setting.BuildVersion,
					Commit:  setting.BuildCommit,
					Env:     cfg.Env,
				},
			},
		},
		{
			desc:        "Hiding version",
			hideVersion: true,
			expected: settings{
				BuildInfo: buildInfo{
					Version: "",
					Commit:  "",
					Env:     cfg.Env,
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			hs.Cfg.Anonymous.HideVersion = test.hideVersion
			expected := test.expected

			recorder := httptest.NewRecorder()
			m.ServeHTTP(recorder, req)
			got := settings{}
			err := json.Unmarshal(recorder.Body.Bytes(), &got)
			require.NoError(t, err)
			require.GreaterOrEqual(t, 400, recorder.Code, "status codes higher than 400 indicate a failure")

			assert.EqualValues(t, expected, got)
		})
	}
}

func TestIntegrationHTTPServer_GetFrontendSettings_pluginsCDNBaseURL(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	type settings struct {
		PluginsCDNBaseURL string `json:"pluginsCDNBaseURL"`
	}

	tests := []struct {
		desc      string
		mutateCfg func(*setting.Cfg)
		expected  settings
	}{
		{
			desc: "With CDN",
			mutateCfg: func(cfg *setting.Cfg) {
				cfg.PluginsCDNURLTemplate = "https://cdn.example.com"
			},
			expected: settings{PluginsCDNBaseURL: "https://cdn.example.com"},
		},
		{
			desc: "Without CDN",
			mutateCfg: func(cfg *setting.Cfg) {
				cfg.PluginsCDNURLTemplate = ""
			},
			expected: settings{PluginsCDNBaseURL: ""},
		},
		{
			desc:     "CDN is disabled by default",
			expected: settings{PluginsCDNBaseURL: ""},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			if test.mutateCfg != nil {
				test.mutateCfg(cfg)
			}
			m, _ := setupTestEnvironment(t, cfg, featuremgmt.WithFeatures(), nil, nil, nil)
			req := httptest.NewRequest(http.MethodGet, "/api/frontend/settings", nil)

			recorder := httptest.NewRecorder()
			m.ServeHTTP(recorder, req)
			var got settings
			err := json.Unmarshal(recorder.Body.Bytes(), &got)
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, recorder.Code)
			require.EqualValues(t, test.expected, got)
		})
	}
}

func TestIntegrationHTTPServer_GetFrontendSettings_apps(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	type settings struct {
		Apps map[string]*plugins.AppDTO `json:"apps"`
	}

	tests := []struct {
		desc           string
		pluginStore    func() pluginstore.Store
		pluginSettings func() pluginsettings.Service
		pluginAssets   func() *pluginassets.Service
		expected       settings
	}{
		{
			desc: "disabled app with preload",
			pluginStore: func() pluginstore.Store {
				return &pluginstore.FakePluginStore{
					PluginList: []pluginstore.Plugin{
						{
							Module: fmt.Sprintf("/%s/module.js", "test-app"),
							// ModuleHash: "sha256-test",
							JSONData: plugins.JSONData{
								ID:      "test-app",
								Info:    plugins.Info{Version: "0.5.0"},
								Type:    plugins.TypeApp,
								Preload: true,
							},
						},
					},
				}
			},
			pluginSettings: func() pluginsettings.Service {
				return &pluginsettings.FakePluginSettings{
					Plugins: newAppSettings("test-app", false),
				}
			},
			pluginAssets: newPluginAssets(),
			expected: settings{
				Apps: map[string]*plugins.AppDTO{
					"test-app": {
						ID:              "test-app",
						Preload:         false,
						Path:            "/test-app/module.js",
						Version:         "0.5.0",
						LoadingStrategy: plugins.LoadingStrategyScript,
						// ModuleHash:      "sha256-test",
					},
				},
			},
		},
		{
			desc: "enabled app with preload",
			pluginStore: func() pluginstore.Store {
				return &pluginstore.FakePluginStore{
					PluginList: []pluginstore.Plugin{
						{
							Module: fmt.Sprintf("/%s/module.js", "test-app"),
							// ModuleHash: "sha256-test",
							JSONData: plugins.JSONData{
								ID:      "test-app",
								Info:    plugins.Info{Version: "0.5.0"},
								Type:    plugins.TypeApp,
								Preload: true,
							},
						},
					},
				}
			},
			pluginSettings: func() pluginsettings.Service {
				return &pluginsettings.FakePluginSettings{
					Plugins: newAppSettings("test-app", true),
				}
			},
			pluginAssets: newPluginAssets(),
			expected: settings{
				Apps: map[string]*plugins.AppDTO{
					"test-app": {
						ID:              "test-app",
						Preload:         true,
						Path:            "/test-app/module.js",
						Version:         "0.5.0",
						LoadingStrategy: plugins.LoadingStrategyScript,
						// ModuleHash:      "sha256-test",
					},
				},
			},
		},
		{
			desc: "angular app plugin",
			pluginStore: func() pluginstore.Store {
				return &pluginstore.FakePluginStore{
					PluginList: []pluginstore.Plugin{
						{
							Module: fmt.Sprintf("/%s/module.js", "test-app"),
							JSONData: plugins.JSONData{
								ID:      "test-app",
								Info:    plugins.Info{Version: "0.5.0"},
								Type:    plugins.TypeApp,
								Preload: true,
							},
							Angular: plugins.AngularMeta{Detected: true},
						},
					},
				}
			},
			pluginSettings: func() pluginsettings.Service {
				return &pluginsettings.FakePluginSettings{
					Plugins: newAppSettings("test-app", true),
				}
			},
			pluginAssets: newPluginAssets(),
			expected: settings{
				Apps: map[string]*plugins.AppDTO{
					"test-app": {
						ID:              "test-app",
						Preload:         true,
						Path:            "/test-app/module.js",
						Version:         "0.5.0",
						Angular:         plugins.AngularMeta{Detected: true},
						LoadingStrategy: plugins.LoadingStrategyFetch,
					},
				},
			},
		},
		{
			desc: "app plugin with create plugin version compatible with script loading strategy",
			pluginStore: func() pluginstore.Store {
				return &pluginstore.FakePluginStore{
					PluginList: []pluginstore.Plugin{
						{
							Module: fmt.Sprintf("/%s/module.js", "test-app"),
							JSONData: plugins.JSONData{
								ID:      "test-app",
								Info:    plugins.Info{Version: "0.5.0"},
								Type:    plugins.TypeApp,
								Preload: true,
							},
						},
					},
				}
			},
			pluginSettings: func() pluginsettings.Service {
				return &pluginsettings.FakePluginSettings{
					Plugins: newAppSettings("test-app", true),
				}
			},
			pluginAssets: newPluginAssetsWithConfig(&config.PluginManagementCfg{
				PluginSettings: map[string]map[string]string{
					"test-app": {
						pluginassets.CreatePluginVersionCfgKey: pluginassets.CreatePluginVersionScriptSupportEnabled,
					},
				},
			}),
			expected: settings{
				Apps: map[string]*plugins.AppDTO{
					"test-app": {
						ID:              "test-app",
						Preload:         true,
						Path:            "/test-app/module.js",
						Version:         "0.5.0",
						LoadingStrategy: plugins.LoadingStrategyScript,
					},
				},
			},
		},
		{
			desc: "app plugin with CDN class",
			pluginStore: func() pluginstore.Store {
				return &pluginstore.FakePluginStore{
					PluginList: []pluginstore.Plugin{
						{
							Class:  plugins.ClassCDN,
							Module: fmt.Sprintf("/%s/module.js", "test-app"),
							JSONData: plugins.JSONData{
								ID:      "test-app",
								Info:    plugins.Info{Version: "0.5.0"},
								Type:    plugins.TypeApp,
								Preload: true,
							},
						},
					},
				}
			},
			pluginSettings: func() pluginsettings.Service {
				return &pluginsettings.FakePluginSettings{
					Plugins: newAppSettings("test-app", true),
				}
			},
			pluginAssets: newPluginAssets(),
			expected: settings{
				Apps: map[string]*plugins.AppDTO{
					"test-app": {
						ID:              "test-app",
						Preload:         true,
						Path:            "/test-app/module.js",
						Version:         "0.5.0",
						LoadingStrategy: plugins.LoadingStrategyFetch,
					},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			m, _ := setupTestEnvironment(t, cfg, featuremgmt.WithFeatures(), test.pluginStore(), test.pluginSettings(), test.pluginAssets())
			req := httptest.NewRequest(http.MethodGet, "/api/frontend/settings", nil)

			recorder := httptest.NewRecorder()
			m.ServeHTTP(recorder, req)
			var got settings
			err := json.Unmarshal(recorder.Body.Bytes(), &got)
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, recorder.Code)
			require.EqualValues(t, test.expected, got)
		})
	}
}

func newAppSettings(id string, enabled bool) map[string]*pluginsettings.DTO {
	return map[string]*pluginsettings.DTO{
		id: {
			ID:       0,
			OrgID:    1,
			PluginID: id,
			Enabled:  enabled,
		},
	}
}

func TestIntegrationHTTPServer_GetFrontendSettings_translations(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	type settings struct {
		Datasources map[string]plugins.DataSourceDTO `json:"datasources"`
		Panels      map[string]*plugins.PanelDTO     `json:"panels"`
		Apps        map[string]*plugins.AppDTO       `json:"apps"`
	}

	tests := []struct {
		desc         string
		pluginStore  func() pluginstore.Store
		expected     settings
		signedInUser *user.SignedInUser
	}{
		{
			desc: "built in datasource plugin with translations",
			pluginStore: func() pluginstore.Store {
				return &pluginstore.FakePluginStore{
					PluginList: []pluginstore.Plugin{
						{
							Module: fmt.Sprintf("/%s/module.js", "test-app"),
							JSONData: plugins.JSONData{
								ID:      "test-app",
								Info:    plugins.Info{Version: "0.5.0"},
								Type:    plugins.TypeDataSource,
								BuiltIn: true,
							},
							Translations: map[string]string{
								"en-US": "public/plugins/test-app/locales/en-US/test-app.json",
								"pt-BR": "public/plugins/test-app/locales/pt-BR/test-app.json",
							},
						},
					},
				}
			},
			expected: settings{
				Datasources: map[string]plugins.DataSourceDTO{
					"": {
						Type:     string(plugins.TypeDataSource),
						JSONData: make(map[string]any),
						PluginMeta: &plugins.PluginMetaDTO{
							JSONData: plugins.JSONData{
								ID:      "test-app",
								Info:    plugins.Info{Version: "0.5.0"},
								Type:    plugins.TypeDataSource,
								BuiltIn: true,
							},
							Module: "/test-app/module.js",
							Translations: map[string]string{
								"en-US": "public/plugins/test-app/locales/en-US/test-app.json",
								"pt-BR": "public/plugins/test-app/locales/pt-BR/test-app.json",
							},
						},
					},
				},
				Panels: map[string]*plugins.PanelDTO{},
				Apps:   map[string]*plugins.AppDTO{},
			},
		},
		{
			desc: "non-builtin datasource plugin with translations",
			pluginStore: func() pluginstore.Store {
				return &pluginstore.FakePluginStore{
					PluginList: []pluginstore.Plugin{
						{
							Module: fmt.Sprintf("/%s/module.js", "test-app"),
							JSONData: plugins.JSONData{
								ID:   "test-app",
								Info: plugins.Info{Version: "0.5.0"},
								Type: plugins.TypeDataSource,
							},
							Translations: map[string]string{
								"en-US": "public/plugins/test-app/locales/en-US/test-app.json",
								"pt-BR": "public/plugins/test-app/locales/pt-BR/test-app.json",
							},
						},
					},
				}
			},
			signedInUser: &user.SignedInUser{
				OrgID: 1,
			},
			expected: settings{
				Datasources: map[string]plugins.DataSourceDTO{
					"test-app": {
						Type:     "test-app",
						Name:     "test-app",
						JSONData: make(map[string]any),
						Module:   "/test-app/module.js",
						PluginMeta: &plugins.PluginMetaDTO{
							Module: "/test-app/module.js",
							JSONData: plugins.JSONData{
								ID:   "test-app",
								Info: plugins.Info{Version: "0.5.0"},
								Type: plugins.TypeDataSource,
							},
							LoadingStrategy: "script",
							Translations: map[string]string{
								"en-US": "public/plugins/test-app/locales/en-US/test-app.json",
								"pt-BR": "public/plugins/test-app/locales/pt-BR/test-app.json",
							},
						},
					},
				},
				Panels: map[string]*plugins.PanelDTO{},
				Apps:   map[string]*plugins.AppDTO{},
			},
		},
		{
			desc: "panel plugin with translations",
			pluginStore: func() pluginstore.Store {
				return &pluginstore.FakePluginStore{
					PluginList: []pluginstore.Plugin{
						{
							Module: fmt.Sprintf("/%s/module.js", "test-app"),
							JSONData: plugins.JSONData{
								ID:   "test-app",
								Info: plugins.Info{Version: "0.5.0"},
								Type: plugins.TypePanel,
							},
							Translations: map[string]string{
								"en-US": "public/plugins/test-app/locales/en-US/test-app.json",
								"pt-BR": "public/plugins/test-app/locales/pt-BR/test-app.json",
							},
						},
					},
				}
			},
			expected: settings{
				Datasources: map[string]plugins.DataSourceDTO{},
				Panels: map[string]*plugins.PanelDTO{
					"test-app": {
						ID:              "test-app",
						Info:            plugins.Info{Version: "0.5.0"},
						Sort:            100,
						Module:          "/test-app/module.js",
						LoadingStrategy: "script",
						ModuleHash:      "",
						Translations: map[string]string{
							"en-US": "public/plugins/test-app/locales/en-US/test-app.json",
							"pt-BR": "public/plugins/test-app/locales/pt-BR/test-app.json",
						},
					},
				},
				Apps: map[string]*plugins.AppDTO{},
			},
		},
		{
			desc: "app plugin with translations",
			pluginStore: func() pluginstore.Store {
				return &pluginstore.FakePluginStore{
					PluginList: []pluginstore.Plugin{
						{
							Module: fmt.Sprintf("/%s/module.js", "test-app"),
							JSONData: plugins.JSONData{
								ID:   "test-app",
								Info: plugins.Info{Version: "0.5.0"},
								Type: plugins.TypeApp,
							},
							Translations: map[string]string{
								"en-US": "public/plugins/test-app/locales/en-US/test-app.json",
								"pt-BR": "public/plugins/test-app/locales/pt-BR/test-app.json",
							},
						},
					},
				}
			},
			expected: settings{
				Datasources: map[string]plugins.DataSourceDTO{},
				Panels:      map[string]*plugins.PanelDTO{},
				Apps: map[string]*plugins.AppDTO{
					"test-app": {
						ID:              "test-app",
						LoadingStrategy: "script",
						ModuleHash:      "",
						Path:            "/test-app/module.js",
						Version:         "0.5.0",
						Translations: map[string]string{
							"en-US": "public/plugins/test-app/locales/en-US/test-app.json",
							"pt-BR": "public/plugins/test-app/locales/pt-BR/test-app.json",
						},
					},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			m, hs := setupTestEnvironment(t, cfg, featuremgmt.WithFeatures(), test.pluginStore(), nil, nil)

			// Create a request with the appropriate context
			req := httptest.NewRequest(http.MethodGet, "/api/frontend/settings", nil)
			recorder := httptest.NewRecorder()

			if test.signedInUser != nil {
				_, err := hs.DataSourcesService.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
					Name:  "test-app",
					Type:  "test-app",
					OrgID: 1,
				})
				require.NoError(t, err)
				m.UseMiddleware(func(next http.Handler) http.Handler {
					return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
						ctx := r.Context()
						reqContext := &contextmodel.ReqContext{
							Context:                    web.FromContext(ctx),
							SignedInUser:               test.signedInUser,
							PublicDashboardAccessToken: "test-token",
						}
						ctx = context.WithValue(ctx, ctxkey.Key{}, reqContext)
						*reqContext.Req = *reqContext.Req.WithContext(ctx)
						next.ServeHTTP(w, r.WithContext(ctx))
					})
				})
			}

			m.ServeHTTP(recorder, req)
			var got settings
			err := json.Unmarshal(recorder.Body.Bytes(), &got)
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, recorder.Code)
			require.EqualValues(t, test.expected, got)
		})
	}
}

func newPluginAssets() func() *pluginassets.Service {
	return newPluginAssetsWithConfig(&config.PluginManagementCfg{})
}

func newPluginAssetsWithConfig(pCfg *config.PluginManagementCfg) func() *pluginassets.Service {
	return func() *pluginassets.Service {
		return pluginassets.ProvideService(pCfg, pluginscdn.ProvideService(pCfg), signature.ProvideService(pCfg, statickey.New()), &pluginstore.FakePluginStore{})
	}
}
