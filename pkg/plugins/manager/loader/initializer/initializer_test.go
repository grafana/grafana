package initializer

import (
	"path"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

func TestInitializer_Initialize(t *testing.T) {
	absCurPath, err := filepath.Abs(".")
	assert.NoError(t, err)

	t.Run("core backend datasource", func(t *testing.T) {
		p := &plugins.PluginV2{
			JSONData: plugins.JSONData{
				Type: plugins.DataSource,
				Includes: []*plugins.PluginInclude{
					{
						Name: "Example dashboard",
						Type: plugins.PluginTypeDashboard,
					},
				},
				Backend: true,
			},
			PluginDir: absCurPath,
			Class:     plugins.Core,
		}

		i := &Initializer{
			cfg: setting.NewCfg(),
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

	t.Run("external app", func(t *testing.T) {
		p := &plugins.PluginV2{
			JSONData: plugins.JSONData{
				ID:   "parent-plugin",
				Type: plugins.App,
				Includes: []*plugins.PluginInclude{
					{
						Type:       "page",
						DefaultNav: true,
						Slug:       "myCustomSlug",
					},
				},
			},
			PluginDir: absCurPath,
			Class:     plugins.External,
			Children: []*plugins.PluginV2{
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

}

func TestInitializer_getPluginEnvVars(t *testing.T) {
	t.Run("backend datasource with license", func(t *testing.T) {
		p := &plugins.PluginV2{
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
			},
			license: licensing,
		}

		envVars := i.getPluginEnvVars(p)
		assert.Len(t, envVars, 4)
		assert.Equal(t, "GF_VERSION=", envVars[0])
		assert.Equal(t, "GF_EDITION=test", envVars[1])
		assert.Equal(t, "GF_ENTERPRISE_license_PATH=/path/to/ent/license", envVars[2])
		assert.Equal(t, "GF_ENTERPRISE_LICENSE_TEXT=", envVars[3])
	})
}

func TestInitializer_getAWSEnvironmentVariables(t *testing.T) {

}

func TestInitializer_getAzureEnvironmentVariables(t *testing.T) {

}

func TestInitializer_handleModuleDefaults(t *testing.T) {

}

func TestInitializer_setPathsBasedOnApp(t *testing.T) {

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

func (t *testLicensingService) LicenseURL(user *models.SignedInUser) string {
	return ""
}

func (t *testLicensingService) HasValidLicense() bool {
	return false
}

func (t *testLicensingService) Environment() map[string]string {
	return map[string]string{"GF_ENTERPRISE_LICENSE_TEXT": t.tokenRaw}
}
