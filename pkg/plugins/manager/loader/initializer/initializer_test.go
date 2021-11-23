package initializer

import (
	"path"
	"path/filepath"
	"testing"

	"github.com/inconshreveable/log15"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/setting"
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
			cfg: setting.NewCfg(),
			log: &fakeLogger{},
		}

		err := i.Initialize(p)
		assert.NoError(t, err)

		assert.Equal(t, "public/img/icn-datasource.svg", p.Info.Logos.Small)
		assert.Equal(t, "public/img/icn-datasource.svg", p.Info.Logos.Large)
		assert.Equal(t, "*", p.Dependencies.GrafanaVersion)
		assert.Len(t, p.Includes, 1)
		assert.Equal(t, models.ROLE_VIEWER, p.Includes[0].Role)
		assert.Equal(t, filepath.Join("app/plugins/datasource", filepath.Base(p.PluginDir), "module"), p.Module)
		assert.Equal(t, path.Join("public/app/plugins/datasource", filepath.Base(p.PluginDir)), p.BaseURL)
		assert.NotNil(t, p.Logger())
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
			cfg: setting.NewCfg(),
			log: fakeLogger{},
		}

		err := i.Initialize(p)
		assert.NoError(t, err)

		// TODO add default img to project
		assert.Equal(t, "public/img/icn-renderer.svg", p.Info.Logos.Small)
		assert.Equal(t, "public/img/icn-renderer.svg", p.Info.Logos.Large)
		assert.Equal(t, ">=8.x", p.Dependencies.GrafanaVersion)
		assert.Equal(t, "plugins/test/module", p.Module)
		assert.Equal(t, "public/plugins/test", p.BaseURL)
		assert.NotNil(t, p.Logger())
		c, exists := p.Client()
		assert.True(t, exists)
		assert.NotNil(t, c)
	})

	t.Run("external app", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "parent-plugin",
				Type: plugins.App,
				Includes: []*plugins.Includes{
					{
						Type:       "page",
						DefaultNav: true,
						Slug:       "myCustomSlug",
					},
				},
			},
			PluginDir: absCurPath,
			Class:     plugins.External,
			Children: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID: "child-plugin",
					},
					PluginDir: absCurPath,
				},
			},
		}

		i := &Initializer{
			cfg: &setting.Cfg{
				AppSubURL: "appSubURL",
			},
			log: fakeLogger{},
		}

		err := i.Initialize(p)
		assert.NoError(t, err)

		assert.Equal(t, "public/img/icn-app.svg", p.Info.Logos.Small)
		assert.Equal(t, "public/img/icn-app.svg", p.Info.Logos.Large)
		assert.Equal(t, "*", p.Dependencies.GrafanaVersion)
		assert.Len(t, p.Includes, 1)
		assert.Equal(t, models.ROLE_VIEWER, p.Includes[0].Role)
		assert.Equal(t, filepath.Join("plugins", p.ID, "module"), p.Module)
		assert.Equal(t, "public/plugins/parent-plugin", p.BaseURL)
		assert.NotNil(t, p.Logger())
		c, exists := p.Client()
		assert.False(t, exists)
		assert.Nil(t, c)

		assert.Len(t, p.Children, 1)
		assert.Equal(t, p.ID, p.Children[0].IncludedInAppID)
		assert.Equal(t, "public/plugins/parent-plugin", p.Children[0].BaseURL)
		assert.Equal(t, "plugins/parent-plugin/module", p.Children[0].Module)
		assert.Equal(t, "appSubURL/plugins/parent-plugin/page/myCustomSlug", p.DefaultNavURL)
	})
}

func TestInitializer_InitializeWithFactory(t *testing.T) {
	t.Run("happy path", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test-plugin",
				Type: plugins.App,
				Includes: []*plugins.Includes{
					{
						Type:       "page",
						DefaultNav: true,
						Slug:       "myCustomSlug",
					},
				},
			},
			PluginDir: "test/folder",
			Class:     plugins.External,
		}
		i := &Initializer{
			cfg: &setting.Cfg{
				AppSubURL: "appSubURL",
			},
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
		assert.NotNil(t, p.Logger())
		client, exists := p.Client()
		assert.True(t, exists)
		assert.NotNil(t, client.(testPlugin))
	})

	t.Run("invalid factory", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test-plugin",
				Type: plugins.App,
				Includes: []*plugins.Includes{
					{
						Type:       "page",
						DefaultNav: true,
						Slug:       "myCustomSlug",
					},
				},
			},
			PluginDir: "test/folder",
			Class:     plugins.External,
		}
		i := &Initializer{
			cfg: &setting.Cfg{
				AppSubURL: "appSubURL",
			},
			log: fakeLogger{},
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
			edition:    "test",
			hasLicense: true,
		}

		i := &Initializer{
			cfg: &setting.Cfg{
				EnterpriseLicensePath: "/path/to/ent/license",
				PluginSettings: map[string]map[string]string{
					"test": {
						"custom_env_var": "customVal",
					},
				},
			},
			license: licensing,
			log:     fakeLogger{},
		}

		envVars := i.envVars(p)
		assert.Len(t, envVars, 5)
		assert.Equal(t, "GF_PLUGIN_CUSTOM_ENV_VAR=customVal", envVars[0])
		assert.Equal(t, "GF_VERSION=", envVars[1])
		assert.Equal(t, "GF_EDITION=test", envVars[2])
		assert.Equal(t, "GF_ENTERPRISE_license_PATH=/path/to/ent/license", envVars[3])
		assert.Equal(t, "GF_ENTERPRISE_LICENSE_TEXT=", envVars[4])
	})
}

func TestInitializer_setPathsBasedOnApp(t *testing.T) {
	t.Run("When setting paths based on core plugin on Windows", func(t *testing.T) {
		i := &Initializer{
			cfg: setting.NewCfg(),
			log: fakeLogger{},
		}

		child := &plugins.Plugin{
			PluginDir: "c:\\grafana\\public\\app\\plugins\\app\\testdata\\datasources\\datasource",
		}
		parent := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID: "testdata",
			},
			Class:     plugins.Core,
			PluginDir: "c:\\grafana\\public\\app\\plugins\\app\\testdata",
			BaseURL:   "public/app/plugins/app/testdata",
		}

		i.setPathsBasedOnApp(parent, child)

		assert.Equal(t, "app/plugins/app/testdata/datasources/datasource/module", child.Module)
		assert.Equal(t, "testdata", child.IncludedInAppID)
		assert.Equal(t, "public/app/plugins/app/testdata", child.BaseURL)
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
	edition    string
	hasLicense bool
	tokenRaw   string
}

func (t *testLicensingService) HasLicense() bool {
	return t.hasLicense
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

func (t *testLicensingService) LicenseURL(showAdminLicensingPage bool) string {
	return ""
}

func (t *testLicensingService) HasValidLicense() bool {
	return false
}

func (t *testLicensingService) Environment() map[string]string {
	return map[string]string{"GF_ENTERPRISE_LICENSE_TEXT": t.tokenRaw}
}

type testPlugin struct {
	backendplugin.Plugin
}

type fakeLogger struct {
	log.Logger
}

func (f fakeLogger) New(_ ...interface{}) log15.Logger {
	return fakeLogger{}
}

func (f fakeLogger) Warn(_ string, _ ...interface{}) {

}
