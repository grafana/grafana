package initializer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

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

		envVars, err := i.envVars(p)
		assert.NoError(t, err)
		assert.Len(t, envVars, 6)
		assert.Equal(t, "GF_PLUGIN_CUSTOM_ENV_VAR=customVal", envVars[0])
		assert.Equal(t, "GF_VERSION=", envVars[1])
		assert.Equal(t, "GF_EDITION=test", envVars[2])
		assert.Equal(t, "GF_ENTERPRISE_LICENSE_PATH=/path/to/ent/license", envVars[3])
		assert.Equal(t, "GF_ENTERPRISE_APP_URL=https://myorg.com/", envVars[4])
		assert.Equal(t, "GF_ENTERPRISE_LICENSE_TEXT=token", envVars[5])
	})
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
