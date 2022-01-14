package initializer

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
)

func TestInitializer_Initialize(t *testing.T) {
	absCurPath, err := filepath.Abs(".")
	assert.NoError(t, err)

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
			PluginDir: absCurPath,
			Class:     plugins.Core,
		}

		i := &Initializer{
			cfg: plugins.NewCfg(),
			log: &fakeLogger{},
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
			PluginDir: absCurPath,
			Class:     plugins.External,
		}

		i := &Initializer{
			cfg: plugins.NewCfg(),
			log: fakeLogger{},
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
			cfg: &plugins.Cfg{},
			log: fakeLogger{},
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

func TestInitializer_InitializeWithFactory(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		p := &plugins.Plugin{}
		i := &Initializer{
			cfg: &plugins.Cfg{},
			log: fakeLogger{},
		}

		factoryInvoked := false

		factory := backendplugin.PluginFactoryFunc(func(pluginID string, logger log.Logger, env []string) (backendplugin.Plugin, error) {
			factoryInvoked = true
			return testPlugin{}, nil
		})

		err := i.InitializeWithFactory(p, factory)
		assert.NoError(t, err)

		assert.True(t, factoryInvoked)
		client, exists := p.Client()
		assert.True(t, exists)
		assert.NotNil(t, client.(testPlugin))
	})

	t.Run("invalid factory", func(t *testing.T) {
		p := &plugins.Plugin{}
		i := &Initializer{
			cfg: &plugins.Cfg{},
			log: fakeLogger{},
			backendProvider: &fakeBackendProvider{
				plugin: p,
			},
		}

		err := i.InitializeWithFactory(p, nil)
		assert.Errorf(t, err, "could not initialize plugin test-plugin")

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

		licensing := &testLicensingService{
			edition:  "test",
			tokenRaw: "token",
		}

		i := &Initializer{
			cfg: &plugins.Cfg{
				EnterpriseLicensePath: "/path/to/ent/license",
				PluginSettings: map[string]map[string]string{
					"test": {
						"custom_env_var": "customVal",
					},
				},
			},
			license: licensing,
			log:     fakeLogger{},
			backendProvider: &fakeBackendProvider{
				plugin: p,
			},
		}

		envVars := i.envVars(p)
		assert.Len(t, envVars, 5)
		assert.Equal(t, "GF_PLUGIN_CUSTOM_ENV_VAR=customVal", envVars[0])
		assert.Equal(t, "GF_VERSION=", envVars[1])
		assert.Equal(t, "GF_EDITION=test", envVars[2])
		assert.Equal(t, "GF_ENTERPRISE_LICENSE_PATH=/path/to/ent/license", envVars[3])
		assert.Equal(t, "GF_ENTERPRISE_LICENSE_TEXT=token", envVars[4])
	})
}

func TestInitializer_getAWSEnvironmentVariables(t *testing.T) {

}

func TestInitializer_getAzureEnvironmentVariables(t *testing.T) {

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

type testLicensingService struct {
	edition  string
	tokenRaw string
}

func (t *testLicensingService) Expiry() int64 {
	return 0
}

func (t *testLicensingService) Edition() string {
	return t.edition
}

func (t *testLicensingService) StateInfo() string {
	return ""
}

func (t *testLicensingService) ContentDeliveryPrefix() string {
	return ""
}

func (t *testLicensingService) LicenseURL(_ bool) string {
	return ""
}

func (t *testLicensingService) Environment() map[string]string {
	return map[string]string{"GF_ENTERPRISE_LICENSE_TEXT": t.tokenRaw}
}

func (*testLicensingService) EnabledFeatures() map[string]bool {
	return map[string]bool{}
}

func (*testLicensingService) FeatureEnabled(feature string) bool {
	return false
}

type testPlugin struct {
	backendplugin.Plugin
}

type fakeLogger struct {
	log.MultiLoggers
}

func (f fakeLogger) New(_ ...interface{}) log.MultiLoggers {
	return log.MultiLoggers{}
}

func (f fakeLogger) Warn(_ string, _ ...interface{}) {

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
