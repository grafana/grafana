package initializer

import (
	"context"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
)

func TestInitializer_Initialize(t *testing.T) {
	t.Run("core backend datasource", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test",
				Type: plugins.DataSource,
				Includes: []*plugins.Includes{
					{
						Name: "Example dashboard",
						Type: plugins.TypeDashboard,
					},
				},
				Backend: true,
			},
			Class: plugins.Core,
		}

		i := &Initializer{
			cfg: &config.Cfg{},
			log: log.NewTestLogger(),
			backendProvider: &fakeBackendProvider{
				plugin: p,
			},
		}

		err := i.Initialize(context.Background(), p)
		assert.NoError(t, err)

		c, exists := p.Client()
		assert.True(t, exists)
		assert.NotNil(t, c)
	})

	t.Run("renderer", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test",
				Type: plugins.Renderer,
				Dependencies: plugins.Dependencies{
					GrafanaVersion: ">=8.x",
				},
				Backend: true,
			},
			Class: plugins.External,
		}

		i := &Initializer{
			cfg: &config.Cfg{},
			log: log.NewTestLogger(),
			backendProvider: &fakeBackendProvider{
				plugin: p,
			},
		}

		err := i.Initialize(context.Background(), p)
		assert.NoError(t, err)

		c, exists := p.Client()
		assert.True(t, exists)
		assert.NotNil(t, c)
	})

	t.Run("secretsmanager", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test",
				Type: plugins.SecretsManager,
				Dependencies: plugins.Dependencies{
					GrafanaVersion: ">=8.x",
				},
				Backend: true,
			},
			Class: plugins.External,
		}

		i := &Initializer{
			cfg: &config.Cfg{},
			log: log.NewTestLogger(),
			backendProvider: &fakeBackendProvider{
				plugin: p,
			},
		}

		err := i.Initialize(context.Background(), p)
		assert.NoError(t, err)

		c, exists := p.Client()
		assert.True(t, exists)
		assert.NotNil(t, c)
	})

	t.Run("non backend plugin app", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				Backend: false,
			},
		}

		i := &Initializer{
			cfg: &config.Cfg{},
			log: log.NewTestLogger(),
			backendProvider: &fakeBackendProvider{
				plugin: p,
			},
		}

		err := i.Initialize(context.Background(), p)
		assert.NoError(t, err)

		c, exists := p.Client()
		assert.False(t, exists)
		assert.Nil(t, c)
	})
}

func TestInitializer_envVars(t *testing.T) {
	t.Run("backend datasource with license", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID: "test",
			},
		}

		licensing := &fakes.FakeLicensingService{
			LicenseEdition: "test",
			TokenRaw:       "token",
			LicensePath:    "/path/to/ent/license",
			LicenseAppURL:  "https://myorg.com/",
		}

		i := &Initializer{
			cfg: &config.Cfg{
				PluginSettings: map[string]map[string]string{
					"test": {
						"custom_env_var": "customVal",
					},
				},
			},
			license: licensing,
			log:     log.NewTestLogger(),
			backendProvider: &fakeBackendProvider{
				plugin: p,
			},
		}

		envVars := i.envVars(p)
		assert.Len(t, envVars, 6)
		assert.Equal(t, "GF_PLUGIN_CUSTOM_ENV_VAR=customVal", envVars[0])
		assert.Equal(t, "GF_VERSION=", envVars[1])
		assert.Equal(t, "GF_EDITION=test", envVars[2])
		assert.Equal(t, "GF_ENTERPRISE_LICENSE_PATH=/path/to/ent/license", envVars[3])
		assert.Equal(t, "GF_ENTERPRISE_APP_URL=https://myorg.com/", envVars[4])
		assert.Equal(t, "GF_ENTERPRISE_LICENSE_TEXT=token", envVars[5])
	})
}

func TestInitializer_tracingEnvironmentVariables(t *testing.T) {
	const pluginID = "plugin_id"

	defaultPlugin := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID:   pluginID,
			Info: plugins.Info{Version: "1.0.0"},
		},
	}
	pluginWithoutVersion := &plugins.Plugin{
		JSONData: plugins.JSONData{ID: pluginID},
	}

	defaultOTelCfg := config.OpenTelemetryCfg{
		Address:     "127.0.0.1:4317",
		Propagation: "",
	}

	expDefaultOtlp := func(t *testing.T, envVars []string) {
		found := map[string]bool{
			"address":        false,
			"plugin_version": false,
			"propagation":    false,
		}
		setFound := func(v string) {
			require.False(t, found[v], "duplicate env var found")
			found[v] = true
		}
		for _, v := range envVars {
			switch v {
			case "GF_PLUGIN_VERSION=1.0.0":
				setFound("plugin_version")
			case "GF_INSTANCE_OTLP_ADDRESS=127.0.0.1:4317":
				setFound("address")
			case "GF_INSTANCE_OTLP_PROPAGATION=":
				setFound("propagation")
			}
		}
		for k, f := range found {
			require.Truef(t, f, "%q env var not found: %+v", k, envVars)
		}
	}
	expNoTracing := func(t *testing.T, envVars []string) {
		for _, v := range envVars {
			assert.False(t, strings.HasPrefix(v, "GF_TRACING"), "should not have tracing env var")
			assert.False(
				t,
				strings.HasPrefix(v, "GF_PLUGIN_VERSION"),
				"GF_PLUGIN_VERSION is tracing-only and should not be present when tracing is disabled",
			)
		}
	}
	expGfPluginVersionNotPresent := func(t *testing.T, envVars []string) {
		for _, e := range envVars {
			assert.False(t, strings.HasPrefix("GF_PLUGIN_VERSION=", e), "GF_PLUGIN_VERSION shouldn't be present")
		}
	}
	expGfPluginVersionPresent := func(t *testing.T, envVars []string) {
		var found bool
		for _, e := range envVars {
			if e != "GF_PLUGIN_VERSION=1.0.0" {
				continue
			}
			assert.False(t, found, "GF_PLUGIN_VERSION is present multiple times")
			found = true
		}
		assert.Truef(t, found, "GF_PLUGIN_VERSION is not present: %+v", envVars)
	}

	for _, tc := range []struct {
		name   string
		cfg    *config.Cfg
		plugin *plugins.Plugin
		exp    func(t *testing.T, envVars []string)
	}{
		{
			name: "otel not configured",
			cfg: &config.Cfg{
				Tracing: config.Tracing{},
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "otel not configured but plugin-tracing enabled",
			cfg: &config.Cfg{
				Tracing:        config.Tracing{},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "otlp no propagation plugin enabled",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
				PluginSettings: map[string]map[string]string{
					pluginID: {"tracing": "true"},
				},
			},
			plugin: defaultPlugin,
			exp:    expDefaultOtlp,
		},
		{
			name: "otlp no propagation disabled by default",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "otlp propagation plugin enabled",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:     "127.0.0.1:4317",
						Propagation: "w3c",
					},
				},
				PluginSettings: map[string]map[string]string{
					pluginID: {"tracing": "true"},
				},
			},
			plugin: defaultPlugin,
			exp: func(t *testing.T, envVars []string) {
				assert.Len(t, envVars, 5)
				assert.Equal(t, "GF_PLUGIN_TRACING=true", envVars[0])
				assert.Equal(t, "GF_VERSION=", envVars[1])
				assert.Equal(t, "GF_PLUGIN_VERSION=1.0.0", envVars[2])
				assert.Equal(t, "GF_INSTANCE_OTLP_ADDRESS=127.0.0.1:4317", envVars[3])
				assert.Equal(t, "GF_INSTANCE_OTLP_PROPAGATION=w3c", envVars[4])
			},
		},
		{
			name: "otlp no propagation disabled by default",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:     "127.0.0.1:4317",
						Propagation: "w3c",
					},
				},
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "disabled on plugin",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
				PluginSettings: setting.PluginSettings{
					pluginID: map[string]string{"tracing": "false"},
				},
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "disabled on plugin with other plugin settings",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
				PluginSettings: map[string]map[string]string{
					pluginID: {"some_other_option": "true"},
				},
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "enabled on plugin with other plugin settings",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
				PluginSettings: map[string]map[string]string{
					pluginID: {"some_other_option": "true", "tracing": "true"},
				},
			},
			plugin: defaultPlugin,
			exp:    expDefaultOtlp,
		},
		{
			name: "GF_PLUGIN_VERSION is not present if tracing is disabled",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{},
				},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: defaultPlugin,
			exp:    expGfPluginVersionNotPresent,
		},
		{
			name: "GF_PLUGIN_VERSION is present if tracing is enabled and plugin has version",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: defaultPlugin,
			exp:    expGfPluginVersionPresent,
		},
		{
			name: "GF_PLUGIN_VERSION is not present if tracing is enabled but plugin doesn't have a version",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{},
				},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: pluginWithoutVersion,
			exp:    expGfPluginVersionNotPresent,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			i := &Initializer{
				cfg: tc.cfg,
				log: log.NewTestLogger(),
			}
			envVars := i.envVars(tc.plugin)
			tc.exp(t, envVars)
		})
	}
}

func TestInitializer_getAWSEnvironmentVariables(t *testing.T) {

}

func TestInitializer_handleModuleDefaults(t *testing.T) {

}

func Test_defaultLogoPath(t *testing.T) {

}

func Test_evalRelativePluginUrlPath(t *testing.T) {

}

func Test_getPluginLogoUrl(t *testing.T) {

}

func Test_getPluginSettings(t *testing.T) {

}

func Test_pluginSettings_ToEnv(t *testing.T) {

}

type fakeBackendProvider struct {
	plugins.BackendFactoryProvider

	plugin *plugins.Plugin
}

func (f *fakeBackendProvider) BackendFactory(_ context.Context, _ *plugins.Plugin) backendplugin.PluginFactoryFunc {
	return func(_ string, _ log.Logger, _ []string) (backendplugin.Plugin, error) {
		return f.plugin, nil
	}
}
