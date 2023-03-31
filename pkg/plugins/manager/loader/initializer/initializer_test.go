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
	t.Run("version", func(t *testing.T) {
		for _, tc := range []struct {
			name  string
			setup func(p *plugins.Plugin)
			exp   func(t *testing.T, i *Initializer, p *plugins.Plugin)
		}{
			{
				name: "not provided",
				setup: func(p *plugins.Plugin) {
					p.Info = plugins.Info{}
				},
				exp: func(t *testing.T, i *Initializer, p *plugins.Plugin) {
					for _, k := range i.envVars(p) {
						if strings.HasPrefix("GF_PLUGIN_VERSION=", k) {
							require.Fail(t, "found unexpected env var GF_PLUGIN_VERSION")
						}
					}
				},
			},
			{
				name: "provided",
				setup: func(p *plugins.Plugin) {
					p.Info = plugins.Info{Version: "0.1"}
				},
				exp: func(t *testing.T, i *Initializer, p *plugins.Plugin) {
					require.Contains(t, i.envVars(p), "GF_PLUGIN_VERSION=0.1")
				},
			},
		} {
			t.Run(tc.name, func(t *testing.T) {
				p := &plugins.Plugin{
					JSONData: plugins.JSONData{
						ID:   "test",
						Info: plugins.Info{Version: "0.1"},
					},
				}
				tc.setup(p)
				i := &Initializer{
					cfg: &config.Cfg{
						Tracing: config.Tracing{Enabled: true},
					},
					log:             log.NewTestLogger(),
					backendProvider: &fakeBackendProvider{plugin: p},
				}
				tc.exp(t, i, p)
			})
		}
	})

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

	p := &plugins.Plugin{
		JSONData: plugins.JSONData{ID: pluginID},
	}

	defaultTracingCfg := config.Tracing{
		Enabled: true,
		OpenTelemetry: config.OpenTelemetryCfg{
			Address:     "127.0.0.1:4317",
			Propagation: "",
		},
	}

	expDefaultOtlp := func(t *testing.T, envVars []string) {
		found := map[string]bool{
			"address":     false,
			"version":     false,
			"propagation": false,
		}
		setFound := func(v string) {
			require.False(t, found[v], "duplicate env var found")
			found[v] = true
		}
		for _, v := range envVars {
			switch v {
			case "GF_VERSION=":
				setFound("version")
			case "GF_INSTANCE_OTLP_ADDRESS=127.0.0.1:4317":
				setFound("address")
			case "GF_INSTANCE_OTLP_PROPAGATION=":
				setFound("propagation")
			}
		}
		for k, f := range found {
			require.Truef(t, f, "%q env var not found", k)
		}
	}
	expNoTracing := func(t *testing.T, envVars []string) {
		for _, v := range envVars {
			assert.False(t, strings.HasPrefix(v, "GF_TRACING"), "should not have tracing env var")
		}
	}

	for _, tc := range []struct {
		name string
		cfg  *config.Cfg
		exp  func(t *testing.T, envVars []string)
	}{
		{
			name: "disabled",
			cfg: &config.Cfg{
				Tracing: config.Tracing{},
			},
			exp: expNoTracing,
		},
		{
			name: "otlp no propagation",
			cfg: &config.Cfg{
				Tracing: defaultTracingCfg,
			},
			exp: expDefaultOtlp,
		},
		{
			name: "otlp propagation",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					Enabled: true,
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:     "127.0.0.1:4317",
						Propagation: "w3c",
					},
				},
			},
			exp: func(t *testing.T, envVars []string) {
				assert.Len(t, envVars, 3)
				assert.Equal(t, "GF_VERSION=", envVars[0])
				assert.Equal(t, "GF_INSTANCE_OTLP_ADDRESS=127.0.0.1:4317", envVars[1])
				assert.Equal(t, "GF_INSTANCE_OTLP_PROPAGATION=w3c", envVars[2])
			},
		},
		{
			name: "disabled on plugin",
			cfg: &config.Cfg{
				Tracing: defaultTracingCfg,
				PluginSettings: setting.PluginSettings{
					pluginID: map[string]string{"tracing": "false"},
				},
			},
			exp: expNoTracing,
		},
		{
			name: "not disabled on plugin with other plugin settings",
			cfg: &config.Cfg{
				Tracing: defaultTracingCfg,
				PluginSettings: map[string]map[string]string{
					pluginID: {"some_other_option": "true"},
				},
			},
			exp: expDefaultOtlp,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			i := &Initializer{
				cfg: tc.cfg,
				log: log.NewTestLogger(),
			}
			envVars := i.envVars(p)
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
