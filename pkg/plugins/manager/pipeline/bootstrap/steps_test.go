package bootstrap

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
)

func TestSetDefaultNavURL(t *testing.T) {
	t.Run("When including a dashboard with DefaultNav: true", func(t *testing.T) {
		pluginWithDashboard := &plugins.Plugin{
			JSONData: plugins.JSONData{Includes: []*plugins.Includes{
				{
					Type:       "dashboard",
					DefaultNav: true,
					UID:        "",
				},
			}},
		}
		logger := log.NewTestLogger()
		pluginWithDashboard.SetLogger(logger)

		t.Run("Default nav URL is not set if dashboard UID field not is set", func(t *testing.T) {
			setDefaultNavURL(pluginWithDashboard)
			require.Equal(t, "", pluginWithDashboard.DefaultNavURL)
			require.NotZero(t, logger.WarnLogs.Calls)
			require.Equal(t, "Included dashboard is missing a UID field", logger.WarnLogs.Message)
		})

		t.Run("Default nav URL is set if dashboard UID field is set", func(t *testing.T) {
			pluginWithDashboard.Includes[0].UID = "a1b2c3"

			setDefaultNavURL(pluginWithDashboard)
			require.Equal(t, "/d/a1b2c3", pluginWithDashboard.DefaultNavURL)
		})
	})

	t.Run("When including a page with DefaultNav: true", func(t *testing.T) {
		pluginWithPage := &plugins.Plugin{
			JSONData: plugins.JSONData{Includes: []*plugins.Includes{
				{
					Type:       "page",
					DefaultNav: true,
					Slug:       "testPage",
				},
			}},
		}

		t.Run("Default nav URL is set using slug", func(t *testing.T) {
			setDefaultNavURL(pluginWithPage)
			require.Equal(t, "/plugins/page/testPage", pluginWithPage.DefaultNavURL)
		})

		t.Run("Default nav URL is set using slugified Name field if Slug field is empty", func(t *testing.T) {
			pluginWithPage.Includes[0].Slug = ""
			pluginWithPage.Includes[0].Name = "My Test Page"

			setDefaultNavURL(pluginWithPage)
			require.Equal(t, "/plugins/page/my-test-page", pluginWithPage.DefaultNavURL)
		})
	})
}

func TestTemplateDecorateFunc(t *testing.T) {
	t.Run("Removes %VERSION%", func(t *testing.T) {
		pluginWithoutVersion := &plugins.Plugin{
			JSONData: plugins.JSONData{
				Info: plugins.Info{
					Version: "%VERSION%",
				},
			},
		}
		p, err := TemplateDecorateFunc(context.TODO(), pluginWithoutVersion)
		require.NoError(t, err)
		require.Equal(t, "", p.Info.Version)
	})

	t.Run("Removes %TODAY%", func(t *testing.T) {
		pluginWithoutVersion := &plugins.Plugin{
			JSONData: plugins.JSONData{
				Info: plugins.Info{
					Version: "%TODAY%",
				},
			},
		}
		p, err := TemplateDecorateFunc(context.TODO(), pluginWithoutVersion)
		require.NoError(t, err)
		require.Equal(t, "", p.Info.Updated)
	})
}

func Test_configureAppChildPlugin(t *testing.T) {
	t.Run("Child plugin will inherit parent version information when version is empty", func(t *testing.T) {
		child := &plugins.Plugin{
			FS: fakes.NewFakePluginFS("c:\\grafana\\public\\app\\plugins\\app\\testdata-app\\datasources\\datasource"),
		}
		parent := &plugins.Plugin{
			JSONData: plugins.JSONData{
				Type: plugins.TypeApp,
				ID:   "testdata-app",
				Info: plugins.Info{Version: "1.0.0"},
			},
			Class:   plugins.ClassCore,
			FS:      fakes.NewFakePluginFS("c:\\grafana\\public\\app\\plugins\\app\\testdata-app"),
			BaseURL: "public/app/plugins/app/testdata-app",
		}

		configureAppChildPlugin(parent, child)

		require.Equal(t, "testdata-app", child.IncludedInAppID)
		require.Equal(t, parent.Info.Version, child.Info.Version)
	})

	t.Run("Child plugin will not inherit parent version information when version is non-empty", func(t *testing.T) {
		child := &plugins.Plugin{
			FS: fakes.NewFakePluginFS("/plugins/parent-app/child-panel"),
			JSONData: plugins.JSONData{
				Info: plugins.Info{Version: "2.0.2"},
			},
		}
		parent := &plugins.Plugin{
			JSONData: plugins.JSONData{
				Type: plugins.TypeApp,
				ID:   "testdata-app",
				Info: plugins.Info{Version: "2.0.0"},
			},
			Class:   plugins.ClassExternal,
			FS:      fakes.NewFakePluginFS("/plugins/parent-app"),
			BaseURL: "plugins/parent-app",
		}

		configureAppChildPlugin(parent, child)

		require.Equal(t, "testdata-app", child.IncludedInAppID)
		require.NotEqual(t, parent.Info.Version, child.Info.Version)
	})
}

func TestSkipEnvVarsDecorateFunc(t *testing.T) {
	const pluginID = "plugin-id"

	t.Run("config field is false", func(t *testing.T) {
		f := SkipHostEnvVarsDecorateFunc(&config.PluginManagementCfg{
			Features: config.Features{SkipHostEnvVarsEnabled: false},
		})
		p, err := f(context.Background(), &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID}})
		require.NoError(t, err)
		require.False(t, p.SkipHostEnvVars)
	})

	t.Run("config field is true", func(t *testing.T) {
		t.Run("no plugin settings should set SkipHostEnvVars to true", func(t *testing.T) {
			f := SkipHostEnvVarsDecorateFunc(&config.PluginManagementCfg{
				Features: config.Features{SkipHostEnvVarsEnabled: true},
			})
			p, err := f(context.Background(), &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID}})
			require.NoError(t, err)
			require.True(t, p.SkipHostEnvVars)
		})

		t.Run("plugin setting", func(t *testing.T) {
			for _, tc := range []struct {
				name               string
				forwardHostEnvVars []string
				expSkipHostEnvVars bool
			}{
				{
					name:               "plugin id not present in forwardHostEnvVars should set SkipHostEnvVars to true (empty)",
					forwardHostEnvVars: []string{},
					expSkipHostEnvVars: true,
				},
				{
					name:               "plugin id not present in forwardHostEnvVars should set SkipHostEnvVars to true (other id)",
					forwardHostEnvVars: []string{"other-id", "yet-another-id"},
					expSkipHostEnvVars: true,
				},
				{
					name:               "plugin id in forwardHostEnvVars should set SkipHostEnvVars to false (only)",
					forwardHostEnvVars: []string{pluginID},
					expSkipHostEnvVars: false,
				},
				{
					name:               "plugin id in forwardHostEnvVars should set SkipHostEnvVars to false (with other)",
					forwardHostEnvVars: []string{"a-plugin", pluginID, "other-id"},
					expSkipHostEnvVars: false,
				},
			} {
				t.Run(tc.name, func(t *testing.T) {
					f := SkipHostEnvVarsDecorateFunc(&config.PluginManagementCfg{
						Features: config.Features{
							SkipHostEnvVarsEnabled: true,
						},
						ForwardHostEnvVars: tc.forwardHostEnvVars,
					})
					p, err := f(context.Background(), &plugins.Plugin{JSONData: plugins.JSONData{ID: pluginID}})
					require.NoError(t, err)
					require.Equal(t, tc.expSkipHostEnvVars, p.SkipHostEnvVars)
				})
			}
		})
	})
}
