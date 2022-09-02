package loader

import (
	"context"
	"errors"
	"path/filepath"
	"sort"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/org"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/provider"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/initializer"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/setting"
)

var compareOpts = cmpopts.IgnoreFields(plugins.Plugin{}, "client", "log")

func TestLoader_Load(t *testing.T) {
	corePluginDir, err := filepath.Abs("./../../../../public")
	if err != nil {
		t.Errorf("could not construct absolute path of core plugins dir")
		return
	}
	parentDir, err := filepath.Abs("../")
	if err != nil {
		t.Errorf("could not construct absolute path of current dir")
		return
	}
	tests := []struct {
		name            string
		class           plugins.Class
		cfg             *plugins.Cfg
		pluginPaths     []string
		existingPlugins map[string]struct{}
		want            []*plugins.Plugin
		pluginErrors    map[string]*plugins.Error
	}{
		{
			name:  "Load a Core plugin",
			class: plugins.Core,
			cfg: &plugins.Cfg{
				PluginsPath: corePluginDir,
			},
			pluginPaths: []string{filepath.Join(corePluginDir, "app/plugins/datasource/cloudwatch")},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "cloudwatch",
						Type: "datasource",
						Name: "CloudWatch",
						Info: plugins.Info{
							Author: plugins.InfoLink{
								Name: "Grafana Labs",
								URL:  "https://grafana.com",
							},
							Description: "Data source for Amazon AWS monitoring service",
							Logos: plugins.Logos{
								Small: "public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png",
								Large: "public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png",
							},
						},
						Includes: []*plugins.Includes{
							{Name: "EC2", Path: "dashboards/ec2.json", Type: "dashboard", Role: "Viewer"},
							{Name: "EBS", Path: "dashboards/EBS.json", Type: "dashboard", Role: "Viewer"},
							{Name: "Lambda", Path: "dashboards/Lambda.json", Type: "dashboard", Role: "Viewer"},
							{Name: "Logs", Path: "dashboards/Logs.json", Type: "dashboard", Role: "Viewer"},
							{Name: "RDS", Path: "dashboards/RDS.json", Type: "dashboard", Role: "Viewer"},
						},
						Dependencies: plugins.Dependencies{
							GrafanaVersion: "*",
							Plugins:        []plugins.Dependency{},
						},
						Category:     "cloud",
						Annotations:  true,
						Metrics:      true,
						Alerting:     true,
						Logs:         true,
						Backend:      true,
						QueryOptions: map[string]bool{"minInterval": true},
					},
					Module:    "app/plugins/datasource/cloudwatch/module",
					BaseURL:   "public/app/plugins/datasource/cloudwatch",
					PluginDir: filepath.Join(corePluginDir, "app/plugins/datasource/cloudwatch"),
					Signature: plugins.SignatureInternal,
					Class:     plugins.Core,
				},
			},
		},
		{
			name:  "Load a Bundled plugin",
			class: plugins.Bundled,
			cfg: &plugins.Cfg{
				PluginsPath: filepath.Join(parentDir, "testdata"),
			},
			pluginPaths: []string{"../testdata/valid-v2-signature"},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "test-datasource",
						Type: "datasource",
						Name: "Test",
						Info: plugins.Info{
							Author: plugins.InfoLink{
								Name: "Will Browne",
								URL:  "https://willbrowne.com",
							},
							Version: "1.0.0",
							Logos: plugins.Logos{
								Small: "public/img/icn-datasource.svg",
								Large: "public/img/icn-datasource.svg",
							},
							Description: "Test",
						},
						Dependencies: plugins.Dependencies{
							GrafanaVersion: "*",
							Plugins:        []plugins.Dependency{},
						},
						Executable: "test",
						Backend:    true,
						State:      "alpha",
					},
					Module:        "plugins/test-datasource/module",
					BaseURL:       "public/plugins/test-datasource",
					PluginDir:     filepath.Join(parentDir, "testdata/valid-v2-signature/plugin/"),
					Signature:     "valid",
					SignatureType: plugins.GrafanaSignature,
					SignatureOrg:  "Grafana Labs",
					Class:         plugins.Bundled,
				},
			},
		}, {
			name:  "Load plugin with symbolic links",
			class: plugins.External,
			cfg: &plugins.Cfg{
				PluginsPath: filepath.Join(parentDir),
			},
			pluginPaths: []string{"../testdata/symbolic-plugin-dirs"},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "test-app",
						Type: "app",
						Name: "Test App",
						Info: plugins.Info{
							Author: plugins.InfoLink{
								Name: "Test Inc.",
								URL:  "http://test.com",
							},
							Logos: plugins.Logos{
								Small: "public/plugins/test-app/img/logo_small.png",
								Large: "public/plugins/test-app/img/logo_large.png",
							},
							Links: []plugins.InfoLink{
								{Name: "Project site", URL: "http://project.com"},
								{Name: "License & Terms", URL: "http://license.com"},
							},
							Description: "Official Grafana Test App & Dashboard bundle",
							Screenshots: []plugins.Screenshots{
								{Path: "public/plugins/test-app/img/screenshot1.png", Name: "img1"},
								{Path: "public/plugins/test-app/img/screenshot2.png", Name: "img2"},
							},
							Version: "1.0.0",
							Updated: "2015-02-10",
						},
						Dependencies: plugins.Dependencies{
							GrafanaVersion: "3.x.x",
							Plugins: []plugins.Dependency{
								{Type: "datasource", ID: "graphite", Name: "Graphite", Version: "1.0.0"},
								{Type: "panel", ID: "graph", Name: "Graph", Version: "1.0.0"},
							},
						},
						Includes: []*plugins.Includes{
							{
								Name: "Nginx Connections",
								Path: "dashboards/connections.json",
								Type: "dashboard",
								Role: "Viewer",
								Slug: "nginx-connections",
							},
							{
								Name: "Nginx Memory",
								Path: "dashboards/memory.json",
								Type: "dashboard",
								Role: "Viewer",
								Slug: "nginx-memory",
							},
							{
								Name: "Nginx Panel",
								Type: "panel",
								Role: "Viewer",
								Slug: "nginx-panel"},
							{
								Name: "Nginx Datasource",
								Type: "datasource",
								Role: "Viewer",
								Slug: "nginx-datasource",
							},
						},
					},
					Class:         plugins.External,
					Module:        "plugins/test-app/module",
					BaseURL:       "public/plugins/test-app",
					PluginDir:     filepath.Join(parentDir, "testdata/includes-symlinks"),
					Signature:     "valid",
					SignatureType: plugins.GrafanaSignature,
					SignatureOrg:  "Grafana Labs",
				},
			},
		}, {
			name:  "Load an unsigned plugin (development)",
			class: plugins.External,
			cfg: &plugins.Cfg{
				DevMode:     true,
				PluginsPath: filepath.Join(parentDir),
			},
			pluginPaths: []string{"../testdata/unsigned-datasource"},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "test-datasource",
						Type: "datasource",
						Name: "Test",
						Info: plugins.Info{
							Author: plugins.InfoLink{
								Name: "Grafana Labs",
								URL:  "https://grafana.com",
							},
							Logos: plugins.Logos{
								Small: "public/img/icn-datasource.svg",
								Large: "public/img/icn-datasource.svg",
							},
							Description: "Test",
						},
						Dependencies: plugins.Dependencies{
							GrafanaVersion: "*",
							Plugins:        []plugins.Dependency{},
						},
						Backend: true,
						State:   plugins.AlphaRelease,
					},
					Class:     plugins.External,
					Module:    "plugins/test-datasource/module",
					BaseURL:   "public/plugins/test-datasource",
					PluginDir: filepath.Join(parentDir, "testdata/unsigned-datasource/plugin"),
					Signature: "unsigned",
				},
			},
		}, {
			name:  "Load an unsigned plugin (production)",
			class: plugins.External,
			cfg: &plugins.Cfg{
				PluginsPath: filepath.Join(parentDir),
			},
			pluginPaths: []string{"../testdata/unsigned-datasource"},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test-datasource": {
					PluginID:  "test-datasource",
					ErrorCode: "signatureMissing",
				},
			},
		},
		{
			name:  "Load an unsigned plugin using PluginsAllowUnsigned config (production)",
			class: plugins.External,
			cfg: &plugins.Cfg{
				PluginsPath:          filepath.Join(parentDir),
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{"../testdata/unsigned-datasource"},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "test-datasource",
						Type: "datasource",
						Name: "Test",
						Info: plugins.Info{
							Author: plugins.InfoLink{
								Name: "Grafana Labs",
								URL:  "https://grafana.com",
							},
							Logos: plugins.Logos{
								Small: "public/img/icn-datasource.svg",
								Large: "public/img/icn-datasource.svg",
							},
							Description: "Test",
						},
						Dependencies: plugins.Dependencies{
							GrafanaVersion: "*",
							Plugins:        []plugins.Dependency{},
						},
						Backend: true,
						State:   plugins.AlphaRelease,
					},
					Class:     plugins.External,
					Module:    "plugins/test-datasource/module",
					BaseURL:   "public/plugins/test-datasource",
					PluginDir: filepath.Join(parentDir, "testdata/unsigned-datasource/plugin"),
					Signature: plugins.SignatureUnsigned,
				},
			},
		},
		{
			name:  "Load an unsigned plugin with modified signature (production)",
			class: plugins.External,
			cfg: &plugins.Cfg{
				PluginsPath: filepath.Join(parentDir),
			},
			pluginPaths: []string{"../testdata/lacking-files"},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test-datasource": {
					PluginID:  "test-datasource",
					ErrorCode: "signatureModified",
				},
			},
		},
		{
			name:  "Load an unsigned plugin with modified signature using PluginsAllowUnsigned config (production) still includes a signing error",
			class: plugins.External,
			cfg: &plugins.Cfg{
				PluginsPath:          filepath.Join(parentDir),
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{"../testdata/lacking-files"},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test-datasource": {
					PluginID:  "test-datasource",
					ErrorCode: "signatureModified",
				},
			},
		},
		{
			name:  "Load a plugin with manifest which has a file not found in plugin folder",
			class: plugins.External,
			cfg: &plugins.Cfg{
				PluginsPath:          filepath.Join(parentDir),
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{"../testdata/invalid-v2-missing-file"},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test-datasource": {
					PluginID:  "test-datasource",
					ErrorCode: "signatureModified",
				},
			},
		},
		{
			name:  "Load a plugin with file which is missing from the manifest",
			class: plugins.External,
			cfg: &plugins.Cfg{
				PluginsPath:          filepath.Join(parentDir),
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{"../testdata/invalid-v2-extra-file"},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test-datasource": {
					PluginID:  "test-datasource",
					ErrorCode: "signatureModified",
				},
			},
		},
		{
			name:  "Load an app with includes",
			class: plugins.External,
			cfg: &plugins.Cfg{
				PluginsPath:          filepath.Join(parentDir),
				PluginsAllowUnsigned: []string{"test-app"},
			},
			pluginPaths: []string{"../testdata/test-app-with-includes"},
			want: []*plugins.Plugin{
				{JSONData: plugins.JSONData{
					ID:   "test-app",
					Type: "app",
					Name: "Test App",
					Info: plugins.Info{
						Author: plugins.InfoLink{
							Name: "Test Inc.",
							URL:  "http://test.com",
						},
						Description: "Official Grafana Test App & Dashboard bundle",
						Version:     "1.0.0",
						Links: []plugins.InfoLink{
							{Name: "Project site", URL: "http://project.com"},
							{Name: "License & Terms", URL: "http://license.com"},
						},
						Logos: plugins.Logos{
							Small: "public/img/icn-app.svg",
							Large: "public/img/icn-app.svg",
						},
						Updated: "2015-02-10",
					},
					Dependencies: plugins.Dependencies{
						GrafanaDependency: ">=8.0.0",
						GrafanaVersion:    "*",
						Plugins:           []plugins.Dependency{},
					},
					Includes: []*plugins.Includes{
						{Name: "Nginx Memory", Path: "dashboards/memory.json", Type: "dashboard", Role: "Viewer", Slug: "nginx-memory"},
						{Name: "Root Page (react)", Type: "page", Role: "Viewer", Path: "/a/my-simple-app", DefaultNav: true, AddToNav: true, Slug: "root-page-react"},
					},
					Backend: false,
				},
					DefaultNavURL: "/plugins/test-app/page/root-page-react",
					PluginDir:     filepath.Join(parentDir, "testdata/test-app-with-includes"),
					Class:         plugins.External,
					Signature:     plugins.SignatureUnsigned,
					Module:        "plugins/test-app/module",
					BaseURL:       "public/plugins/test-app",
				},
			},
		},
	}
	for _, tt := range tests {
		l := newLoader(tt.cfg)
		t.Run(tt.name, func(t *testing.T) {
			got, err := l.Load(context.Background(), tt.class, tt.pluginPaths, tt.existingPlugins)
			require.NoError(t, err)
			if !cmp.Equal(got, tt.want, compareOpts) {
				t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, tt.want, compareOpts))
			}

			pluginErrs := l.PluginErrors()
			assert.Equal(t, len(tt.pluginErrors), len(pluginErrs))
			for _, pluginErr := range pluginErrs {
				assert.Equal(t, tt.pluginErrors[pluginErr.PluginID], pluginErr)
			}
		})
	}
}

func TestLoader_setDefaultNavURL(t *testing.T) {
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
		logger := &logtest.Fake{}
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

func TestLoader_Load_MultiplePlugins(t *testing.T) {
	parentDir, err := filepath.Abs("../")
	if err != nil {
		t.Errorf("could not construct absolute path of current dir")
		return
	}

	t.Run("Load multiple", func(t *testing.T) {
		tests := []struct {
			name            string
			cfg             *plugins.Cfg
			pluginPaths     []string
			appURL          string
			existingPlugins map[string]struct{}
			want            []*plugins.Plugin
			pluginErrors    map[string]*plugins.Error
		}{
			{
				name: "Load multiple plugins (broken, valid, unsigned)",
				cfg: &plugins.Cfg{
					PluginsPath: filepath.Join(parentDir),
				},
				appURL: "http://localhost:3000",
				pluginPaths: []string{
					"../testdata/invalid-plugin-json",    // test-app
					"../testdata/valid-v2-pvt-signature", // test
					"../testdata/unsigned-panel",         // test-panel
				},
				want: []*plugins.Plugin{
					{
						JSONData: plugins.JSONData{
							ID:   "test-datasource",
							Type: "datasource",
							Name: "Test",
							Info: plugins.Info{
								Author: plugins.InfoLink{
									Name: "Will Browne",
									URL:  "https://willbrowne.com",
								},
								Logos: plugins.Logos{
									Small: "public/img/icn-datasource.svg",
									Large: "public/img/icn-datasource.svg",
								},
								Description: "Test",
								Version:     "1.0.0",
							},
							Dependencies: plugins.Dependencies{
								GrafanaVersion: "*",
								Plugins:        []plugins.Dependency{},
							},
							Backend:    true,
							Executable: "test",
							State:      plugins.AlphaRelease,
						},
						Class:         plugins.External,
						Module:        "plugins/test-datasource/module",
						BaseURL:       "public/plugins/test-datasource",
						PluginDir:     filepath.Join(parentDir, "testdata/valid-v2-pvt-signature/plugin"),
						Signature:     "valid",
						SignatureType: plugins.PrivateSignature,
						SignatureOrg:  "Will Browne",
					},
				},
				pluginErrors: map[string]*plugins.Error{
					"test-panel": {
						PluginID:  "test-panel",
						ErrorCode: "signatureMissing",
					},
				},
			},
		}

		for _, tt := range tests {
			l := newLoader(tt.cfg)
			t.Run(tt.name, func(t *testing.T) {
				origAppURL := setting.AppUrl
				t.Cleanup(func() {
					setting.AppUrl = origAppURL
				})
				setting.AppUrl = tt.appURL

				got, err := l.Load(context.Background(), plugins.External, tt.pluginPaths, tt.existingPlugins)
				require.NoError(t, err)
				sort.SliceStable(got, func(i, j int) bool {
					return got[i].ID < got[j].ID
				})
				if !cmp.Equal(got, tt.want, compareOpts) {
					t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, tt.want, compareOpts))
				}
				pluginErrs := l.PluginErrors()
				require.Equal(t, len(tt.pluginErrors), len(pluginErrs))
				for _, pluginErr := range pluginErrs {
					require.Equal(t, tt.pluginErrors[pluginErr.PluginID], pluginErr)
				}
			})
		}
	})
}

func TestLoader_Signature_RootURL(t *testing.T) {
	const defaultAppURL = "http://localhost:3000/grafana"

	parentDir, err := filepath.Abs("../")
	if err != nil {
		t.Errorf("could not construct absolute path of current dir")
		return
	}

	t.Run("Private signature verification ignores trailing slash in root URL", func(t *testing.T) {
		origAppURL := setting.AppUrl
		origAppSubURL := setting.AppSubUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
			setting.AppSubUrl = origAppSubURL
		})
		setting.AppUrl = defaultAppURL

		paths := []string{"../testdata/valid-v2-pvt-signature-root-url-uri"}

		expected := []*plugins.Plugin{
			{
				JSONData: plugins.JSONData{
					ID:   "test-datasource",
					Type: "datasource",
					Name: "Test",
					Info: plugins.Info{
						Author:      plugins.InfoLink{Name: "Will Browne", URL: "https://willbrowne.com"},
						Description: "Test",
						Logos: plugins.Logos{
							Small: "public/img/icn-datasource.svg",
							Large: "public/img/icn-datasource.svg",
						},
						Version: "1.0.0",
					},
					State:        plugins.AlphaRelease,
					Dependencies: plugins.Dependencies{GrafanaVersion: "*", Plugins: []plugins.Dependency{}},
					Backend:      true,
					Executable:   "test",
				},
				PluginDir:     filepath.Join(parentDir, "/testdata/valid-v2-pvt-signature-root-url-uri/plugin"),
				Class:         plugins.External,
				Signature:     plugins.SignatureValid,
				SignatureType: plugins.PrivateSignature,
				SignatureOrg:  "Will Browne",
				Module:        "plugins/test-datasource/module",
				BaseURL:       "public/plugins/test-datasource",
			},
		}

		l := newLoader(&plugins.Cfg{PluginsPath: filepath.Join(parentDir)})
		got, err := l.Load(context.Background(), plugins.External, paths, map[string]struct{}{})
		assert.NoError(t, err)

		if !cmp.Equal(got, expected, compareOpts) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts))
		}
	})
}

func TestLoader_Load_DuplicatePlugins(t *testing.T) {
	t.Run("Load duplicate plugin folders", func(t *testing.T) {
		pluginDir, err := filepath.Abs("../testdata/test-app")
		if err != nil {
			t.Errorf("could not construct absolute path of plugin dir")
			return
		}
		expected := []*plugins.Plugin{
			{
				JSONData: plugins.JSONData{
					ID:   "test-app",
					Type: "app",
					Name: "Test App",
					Info: plugins.Info{
						Author: plugins.InfoLink{
							Name: "Test Inc.",
							URL:  "http://test.com",
						},
						Description: "Official Grafana Test App & Dashboard bundle",
						Version:     "1.0.0",
						Links: []plugins.InfoLink{
							{Name: "Project site", URL: "http://project.com"},
							{Name: "License & Terms", URL: "http://license.com"},
						},
						Logos: plugins.Logos{
							Small: "public/plugins/test-app/img/logo_small.png",
							Large: "public/plugins/test-app/img/logo_large.png",
						},
						Screenshots: []plugins.Screenshots{
							{Path: "public/plugins/test-app/img/screenshot1.png", Name: "img1"},
							{Path: "public/plugins/test-app/img/screenshot2.png", Name: "img2"},
						},
						Updated: "2015-02-10",
					},
					Dependencies: plugins.Dependencies{
						GrafanaVersion: "3.x.x",
						Plugins: []plugins.Dependency{
							{Type: "datasource", ID: "graphite", Name: "Graphite", Version: "1.0.0"},
							{Type: "panel", ID: "graph", Name: "Graph", Version: "1.0.0"},
						},
					},
					Includes: []*plugins.Includes{
						{Name: "Nginx Connections", Path: "dashboards/connections.json", Type: "dashboard", Role: "Viewer", Slug: "nginx-connections"},
						{Name: "Nginx Memory", Path: "dashboards/memory.json", Type: "dashboard", Role: "Viewer", Slug: "nginx-memory"},
						{Name: "Nginx Panel", Type: "panel", Role: "Viewer", Slug: "nginx-panel"},
						{Name: "Nginx Datasource", Type: "datasource", Role: "Viewer", Slug: "nginx-datasource"},
					},
					Backend: false,
				},
				PluginDir:     pluginDir,
				Class:         plugins.External,
				Signature:     plugins.SignatureValid,
				SignatureType: plugins.GrafanaSignature,
				SignatureOrg:  "Grafana Labs",
				Module:        "plugins/test-app/module",
				BaseURL:       "public/plugins/test-app",
			},
		}

		l := newLoader(&plugins.Cfg{
			PluginsPath: filepath.Dir(pluginDir),
		})

		got, err := l.Load(context.Background(), plugins.External, []string{pluginDir, pluginDir}, map[string]struct{}{})
		assert.NoError(t, err)

		if !cmp.Equal(got, expected, compareOpts) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts))
		}
	})
}

func TestLoader_loadNestedPlugins(t *testing.T) {
	rootDir, err := filepath.Abs("../")
	if err != nil {
		t.Errorf("could not construct absolute path of root dir")
		return
	}
	parent := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID:   "test-datasource",
			Type: "datasource",
			Name: "Parent",
			Info: plugins.Info{
				Author: plugins.InfoLink{
					Name: "Grafana Labs",
					URL:  "http://grafana.com",
				},
				Logos: plugins.Logos{
					Small: "public/img/icn-datasource.svg",
					Large: "public/img/icn-datasource.svg",
				},
				Description: "Parent plugin",
				Version:     "1.0.0",
				Updated:     "2020-10-20",
			},
			Dependencies: plugins.Dependencies{
				GrafanaVersion: "*",
				Plugins:        []plugins.Dependency{},
			},
			Backend: true,
		},
		Module:        "plugins/test-datasource/module",
		BaseURL:       "public/plugins/test-datasource",
		PluginDir:     filepath.Join(rootDir, "testdata/nested-plugins/parent"),
		Signature:     plugins.SignatureValid,
		SignatureType: plugins.GrafanaSignature,
		SignatureOrg:  "Grafana Labs",
		Class:         plugins.External,
	}

	child := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID:   "test-panel",
			Type: "panel",
			Name: "Child",
			Info: plugins.Info{
				Author: plugins.InfoLink{
					Name: "Grafana Labs",
					URL:  "http://grafana.com",
				},
				Logos: plugins.Logos{
					Small: "public/img/icn-panel.svg",
					Large: "public/img/icn-panel.svg",
				},
				Description: "Child plugin",
				Version:     "1.0.1",
				Updated:     "2020-10-30",
			},
			Dependencies: plugins.Dependencies{
				GrafanaVersion: "*",
				Plugins:        []plugins.Dependency{},
			},
		},
		Module:        "plugins/test-panel/module",
		BaseURL:       "public/plugins/test-panel",
		PluginDir:     filepath.Join(rootDir, "testdata/nested-plugins/parent/nested"),
		Signature:     plugins.SignatureValid,
		SignatureType: plugins.GrafanaSignature,
		SignatureOrg:  "Grafana Labs",
		Class:         plugins.External,
	}

	parent.Children = []*plugins.Plugin{child}
	child.Parent = parent

	t.Run("Load nested External plugins", func(t *testing.T) {
		expected := []*plugins.Plugin{parent, child}
		l := newLoader(&plugins.Cfg{
			PluginsPath: rootDir,
		})

		got, err := l.Load(context.Background(), plugins.External, []string{"../testdata/nested-plugins"}, map[string]struct{}{})
		assert.NoError(t, err)

		// to ensure we can compare with expected
		sort.SliceStable(got, func(i, j int) bool {
			return got[i].ID < got[j].ID
		})

		if !cmp.Equal(got, expected, compareOpts) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts))
		}
	})

	t.Run("Load will exclude plugins that already exist", func(t *testing.T) {
		// parent/child links will not be created when either plugins are provided in the existingPlugins map
		parent.Children = nil
		expected := []*plugins.Plugin{parent}

		l := newLoader(&plugins.Cfg{
			PluginsPath: rootDir,
		})

		got, err := l.Load(context.Background(), plugins.External, []string{"../testdata/nested-plugins"}, map[string]struct{}{
			"test-panel": {},
		})
		assert.NoError(t, err)

		// to ensure we can compare with expected
		sort.SliceStable(got, func(i, j int) bool {
			return got[i].ID < got[j].ID
		})

		if !cmp.Equal(got, expected, compareOpts) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts))
		}
	})

	t.Run("Plugin child field `IncludedInAppID` is set to parent app's plugin ID", func(t *testing.T) {
		parent := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "myorgid-simple-app",
				Type: "app",
				Name: "Simple App",
				Info: plugins.Info{
					Author: plugins.InfoLink{
						Name: "Your Name",
					},
					Links: []plugins.InfoLink{
						{Name: "Website", URL: "https://github.com/grafana/grafana-starter-app"},
						{Name: "License", URL: "https://github.com/grafana/grafana-starter-app/blob/master/LICENSE"},
					},
					Logos: plugins.Logos{
						Small: "public/plugins/myorgid-simple-app/img/logo.svg",
						Large: "public/plugins/myorgid-simple-app/img/logo.svg",
					},
					Screenshots: []plugins.Screenshots{},
					Description: "Grafana App Plugin Template",
					Version:     "%VERSION%",
					Updated:     "%TODAY%",
				},
				Dependencies: plugins.Dependencies{
					GrafanaVersion:    "7.0.0",
					GrafanaDependency: ">=7.0.0",
					Plugins:           []plugins.Dependency{},
				},
				Includes: []*plugins.Includes{
					{
						Name:       "Root Page (react)",
						Path:       "/a/myorgid-simple-app",
						Type:       "page",
						Role:       "Viewer",
						AddToNav:   true,
						DefaultNav: true,
						Slug:       "root-page-react",
					},
					{
						Name:     "Root Page (Tab B)",
						Path:     "/a/myorgid-simple-app/?tab=b",
						Type:     "page",
						Role:     "Viewer",
						AddToNav: true,
						Slug:     "root-page-tab-b",
					},
					{
						Name:     "React Config",
						Path:     "/plugins/myorgid-simple-app/?page=page2",
						Type:     "page",
						Role:     "Admin",
						AddToNav: true,
						Slug:     "react-config",
					},
					{
						Name: "Streaming Example",
						Path: "dashboards/streaming.json",
						Type: "dashboard",
						Role: "Viewer",
						Slug: "streaming-example",
					},
					{
						Name: "Lots of Stats",
						Path: "dashboards/stats.json",
						Type: "dashboard",
						Role: "Viewer",
						Slug: "lots-of-stats",
					},
				},
				Backend: false,
			},
			Module:        "plugins/myorgid-simple-app/module",
			BaseURL:       "public/plugins/myorgid-simple-app",
			PluginDir:     filepath.Join(rootDir, "testdata/app-with-child/dist"),
			DefaultNavURL: "/plugins/myorgid-simple-app/page/root-page-react",
			Signature:     plugins.SignatureValid,
			SignatureType: plugins.GrafanaSignature,
			SignatureOrg:  "Grafana Labs",
			Class:         plugins.External,
		}

		child := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "myorgid-simple-panel",
				Type: "panel",
				Name: "Grafana Panel Plugin Template",
				Info: plugins.Info{
					Author: plugins.InfoLink{
						Name: "Your Name",
					},
					Links: []plugins.InfoLink{
						{Name: "Website", URL: "https://github.com/grafana/grafana-starter-panel"},
						{Name: "License", URL: "https://github.com/grafana/grafana-starter-panel/blob/master/LICENSE"},
					},
					Logos: plugins.Logos{
						Small: "public/plugins/myorgid-simple-panel/img/logo.svg",
						Large: "public/plugins/myorgid-simple-panel/img/logo.svg",
					},
					Screenshots: []plugins.Screenshots{},
					Description: "Grafana Panel Plugin Template",
					Version:     "%VERSION%",
					Updated:     "%TODAY%",
				},
				Dependencies: plugins.Dependencies{
					GrafanaDependency: ">=7.0.0",
					GrafanaVersion:    "*",
					Plugins:           []plugins.Dependency{},
				},
			},
			Module:          "plugins/myorgid-simple-app/child/module",
			BaseURL:         "public/plugins/myorgid-simple-app",
			PluginDir:       filepath.Join(rootDir, "testdata/app-with-child/dist/child"),
			IncludedInAppID: parent.ID,
			Signature:       plugins.SignatureValid,
			SignatureType:   plugins.GrafanaSignature,
			SignatureOrg:    "Grafana Labs",
			Class:           plugins.External,
		}

		parent.Children = []*plugins.Plugin{child}
		child.Parent = parent

		expected := []*plugins.Plugin{parent, child}
		l := newLoader(&plugins.Cfg{
			PluginsPath: rootDir,
		})

		got, err := l.Load(context.Background(), plugins.External, []string{"../testdata/app-with-child"}, map[string]struct{}{})
		assert.NoError(t, err)

		// to ensure we can compare with expected
		sort.SliceStable(got, func(i, j int) bool {
			return got[i].ID < got[j].ID
		})

		if !cmp.Equal(got, expected, compareOpts) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts))
		}

		t.Run("order of loaded parent and child plugins gives same output", func(t *testing.T) {
			parentPluginJSON := filepath.Join(rootDir, "testdata/app-with-child/dist/plugin.json")
			childPluginJSON := filepath.Join(rootDir, "testdata/app-with-child/dist/child/plugin.json")

			got, err := l.loadPlugins(context.Background(), plugins.External, []string{
				parentPluginJSON, childPluginJSON},
				map[string]struct{}{})
			assert.NoError(t, err)

			// to ensure we can compare with expected
			sort.SliceStable(got, func(i, j int) bool {
				return got[i].ID < got[j].ID
			})

			if !cmp.Equal(got, expected, compareOpts) {
				t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts))
			}

			got, err = l.loadPlugins(context.Background(), plugins.External, []string{
				childPluginJSON, parentPluginJSON},
				map[string]struct{}{})
			assert.NoError(t, err)

			// to ensure we can compare with expected
			sort.SliceStable(got, func(i, j int) bool {
				return got[i].ID < got[j].ID
			})

			if !cmp.Equal(got, expected, compareOpts) {
				t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts))
			}
		})
	})
}

func TestLoader_readPluginJSON(t *testing.T) {
	tests := []struct {
		name       string
		pluginPath string
		expected   plugins.JSONData
		failed     bool
	}{
		{
			name:       "Valid plugin",
			pluginPath: "../testdata/test-app/plugin.json",
			expected: plugins.JSONData{
				ID:   "test-app",
				Type: "app",
				Name: "Test App",
				Info: plugins.Info{
					Author: plugins.InfoLink{
						Name: "Test Inc.",
						URL:  "http://test.com",
					},
					Description: "Official Grafana Test App & Dashboard bundle",
					Version:     "1.0.0",
					Links: []plugins.InfoLink{
						{Name: "Project site", URL: "http://project.com"},
						{Name: "License & Terms", URL: "http://license.com"},
					},
					Logos: plugins.Logos{
						Small: "img/logo_small.png",
						Large: "img/logo_large.png",
					},
					Screenshots: []plugins.Screenshots{
						{Path: "img/screenshot1.png", Name: "img1"},
						{Path: "img/screenshot2.png", Name: "img2"},
					},
					Updated: "2015-02-10",
				},
				Dependencies: plugins.Dependencies{
					GrafanaVersion: "3.x.x",
					Plugins: []plugins.Dependency{
						{Type: "datasource", ID: "graphite", Name: "Graphite", Version: "1.0.0"},
						{Type: "panel", ID: "graph", Name: "Graph", Version: "1.0.0"},
					},
				},
				Includes: []*plugins.Includes{
					{Name: "Nginx Connections", Path: "dashboards/connections.json", Type: "dashboard", Role: org.RoleViewer},
					{Name: "Nginx Memory", Path: "dashboards/memory.json", Type: "dashboard", Role: org.RoleViewer},
					{Name: "Nginx Panel", Type: "panel", Role: org.RoleViewer},
					{Name: "Nginx Datasource", Type: "datasource", Role: org.RoleViewer},
				},
				Backend: false,
			},
		},
		{
			name:       "Invalid plugin JSON",
			pluginPath: "../testdata/invalid-plugin-json/plugin.json",
			failed:     true,
		},
		{
			name:       "Non-existing JSON file",
			pluginPath: "nonExistingFile.json",
			failed:     true,
		},
	}

	l := newLoader(nil)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := l.readPluginJSON(tt.pluginPath)
			if (err != nil) && !tt.failed {
				t.Errorf("readPluginJSON() error = %v, failed %v", err, tt.failed)
				return
			}
			if !cmp.Equal(got, tt.expected, compareOpts) {
				t.Errorf("Unexpected pluginJSONData: %v", cmp.Diff(got, tt.expected, compareOpts))
			}
		})
	}
}

func Test_validatePluginJSON(t *testing.T) {
	type args struct {
		data plugins.JSONData
	}
	tests := []struct {
		name string
		args args
		err  error
	}{
		{
			name: "Valid case",
			args: args{
				data: plugins.JSONData{
					ID:   "grafana-plugin-id",
					Type: plugins.DataSource,
				},
			},
		},
		{
			name: "Invalid plugin ID",
			args: args{
				data: plugins.JSONData{
					Type: plugins.Panel,
				},
			},
			err: ErrInvalidPluginJSON,
		},
		{
			name: "Invalid plugin type",
			args: args{
				data: plugins.JSONData{
					ID:   "grafana-plugin-id",
					Type: "test",
				},
			},
			err: ErrInvalidPluginJSON,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := validatePluginJSON(tt.args.data); !errors.Is(err, tt.err) {
				t.Errorf("validatePluginJSON() = %v, want %v", err, tt.err)
			}
		})
	}
}

func Test_setPathsBasedOnApp(t *testing.T) {
	t.Run("When setting paths based on core plugin on Windows", func(t *testing.T) {
		child := &plugins.Plugin{
			PluginDir: "c:\\grafana\\public\\app\\plugins\\app\\testdata-app\\datasources\\datasource",
		}
		parent := &plugins.Plugin{
			JSONData: plugins.JSONData{
				Type: plugins.App,
				ID:   "testdata-app",
			},
			Class:     plugins.Core,
			PluginDir: "c:\\grafana\\public\\app\\plugins\\app\\testdata-app",
			BaseURL:   "public/app/plugins/app/testdata-app",
		}

		configureAppChildOPlugin(parent, child)

		assert.Equal(t, "app/plugins/app/testdata-app/datasources/datasource/module", child.Module)
		assert.Equal(t, "testdata-app", child.IncludedInAppID)
		assert.Equal(t, "public/app/plugins/app/testdata-app", child.BaseURL)
	})
}

func newLoader(cfg *plugins.Cfg) *Loader {
	return &Loader{
		cfg:                cfg,
		pluginFinder:       finder.New(),
		pluginInitializer:  initializer.New(cfg, provider.ProvideService(coreplugin.NewRegistry(make(map[string]backendplugin.PluginFactoryFunc))), &fakeLicensingService{}),
		signatureValidator: signature.NewValidator(signature.NewUnsignedAuthorizer(cfg)),
		errs:               make(map[string]*plugins.SignatureError),
		log:                &logtest.Fake{},
	}
}

type fakeLicensingService struct {
	edition  string
	tokenRaw string
}

func (t *fakeLicensingService) Expiry() int64 {
	return 0
}

func (t *fakeLicensingService) Edition() string {
	return t.edition
}

func (t *fakeLicensingService) StateInfo() string {
	return ""
}

func (t *fakeLicensingService) ContentDeliveryPrefix() string {
	return ""
}

func (t *fakeLicensingService) LicenseURL(_ bool) string {
	return ""
}

func (t *fakeLicensingService) Environment() map[string]string {
	return map[string]string{"GF_ENTERPRISE_LICENSE_TEXT": t.tokenRaw}
}

func (*fakeLicensingService) EnabledFeatures() map[string]bool {
	return map[string]bool{}
}

func (*fakeLicensingService) FeatureEnabled(feature string) bool {
	return false
}
