package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/updatechecker"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func setupTestEnvironment(t *testing.T, cfg *setting.Cfg, features *featuremgmt.FeatureManager, pstore plugins.Store, psettings pluginsettings.Service) (*web.Mux, *HTTPServer) {
	t.Helper()
	db.InitTestDB(t)
	cfg.IsFeatureToggleEnabled = features.IsEnabled

	{
		oldVersion := setting.BuildVersion
		oldCommit := setting.BuildCommit
		oldEnv := setting.Env
		t.Cleanup(func() {
			setting.BuildVersion = oldVersion
			setting.BuildCommit = oldCommit
			setting.Env = oldEnv
		})
	}

	var pluginStore = pstore
	if pluginStore == nil {
		pluginStore = &plugins.FakePluginStore{}
	}

	var pluginsSettings = psettings
	if pluginsSettings == nil {
		pluginsSettings = &pluginsettings.FakePluginSettings{}
	}

	hs := &HTTPServer{
		Cfg:      cfg,
		Features: features,
		License:  &licensing.OSSLicensingService{Cfg: cfg},
		RenderService: &rendering.RenderingService{
			Cfg:                   cfg,
			RendererPluginManager: &fakeRendererManager{},
		},
		SQLStore:             db.InitTestDB(t),
		SettingsProvider:     setting.ProvideProvider(cfg),
		pluginStore:          pluginStore,
		grafanaUpdateChecker: &updatechecker.GrafanaService{},
		AccessControl:        accesscontrolmock.New().WithDisabled(),
		PluginSettings:       pluginsSettings,
		pluginsCDNService: pluginscdn.ProvideService(&config.Cfg{
			PluginsCDNURLTemplate: cfg.PluginsCDNURLTemplate,
			PluginSettings:        cfg.PluginSettings,
		}),
		SocialService: social.ProvideService(cfg, features, &usagestats.UsageStatsMock{}),
	}

	m := web.New()
	m.Use(getContextHandler(t, cfg).Middleware)
	m.UseMiddleware(web.Renderer(filepath.Join(setting.StaticRootPath, "views"), "[[", "]]"))
	m.Get("/api/frontend/settings/", hs.GetFrontendSettings)

	return m, hs
}

func TestHTTPServer_GetFrontendSettings_hideVersionAnonymous(t *testing.T) {
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

	m, hs := setupTestEnvironment(t, cfg, featuremgmt.WithFeatures(), nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/frontend/settings", nil)

	// TODO: Remove
	setting.BuildVersion = cfg.BuildVersion
	setting.BuildCommit = cfg.BuildCommit
	setting.Env = cfg.Env

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
					Env:     setting.Env,
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
					Env:     setting.Env,
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			hs.Cfg.AnonymousHideVersion = test.hideVersion
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

func TestHTTPServer_GetFrontendSettings_pluginsCDNBaseURL(t *testing.T) {
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
			m, _ := setupTestEnvironment(t, cfg, featuremgmt.WithFeatures(), nil, nil)
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

func TestHTTPServer_GetFrontendSettings_apps(t *testing.T) {
	type settings struct {
		Apps map[string]*plugins.AppDTO `json:"apps"`
	}

	tests := []struct {
		desc           string
		pluginStore    func() plugins.Store
		pluginSettings func() pluginsettings.Service
		expected       settings
	}{
		{
			desc: "disabled app with preload",
			pluginStore: func() plugins.Store {
				return &plugins.FakePluginStore{
					PluginList: []plugins.PluginDTO{
						{
							Module: fmt.Sprintf("/%s/module.js", "test-app"),
							JSONData: plugins.JSONData{
								ID:      "test-app",
								Info:    plugins.Info{Version: "0.5.0"},
								Type:    plugins.App,
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
			expected: settings{
				Apps: map[string]*plugins.AppDTO{
					"test-app": {
						ID:      "test-app",
						Preload: false,
						Path:    "/test-app/module.js",
						Version: "0.5.0",
					},
				},
			},
		},
		{
			desc: "enalbed app with preload",
			pluginStore: func() plugins.Store {
				return &plugins.FakePluginStore{
					PluginList: []plugins.PluginDTO{
						{
							Module: fmt.Sprintf("/%s/module.js", "test-app"),
							JSONData: plugins.JSONData{
								ID:      "test-app",
								Info:    plugins.Info{Version: "0.5.0"},
								Type:    plugins.App,
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
			expected: settings{
				Apps: map[string]*plugins.AppDTO{
					"test-app": {
						ID:      "test-app",
						Preload: true,
						Path:    "/test-app/module.js",
						Version: "0.5.0",
					},
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			m, _ := setupTestEnvironment(t, cfg, featuremgmt.WithFeatures(), test.pluginStore(), test.pluginSettings())
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
