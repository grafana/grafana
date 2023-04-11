package loader

import (
	"context"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/initializer"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/setting"
)

var compareOpts = []cmp.Option{cmpopts.IgnoreFields(plugins.Plugin{}, "client", "log"), localFSComparer}

var localFSComparer = cmp.Comparer(func(fs1 plugins.LocalFS, fs2 plugins.LocalFS) bool {
	fs1Files := fs1.Files()
	fs2Files := fs2.Files()

	finder.NewLocalFinder()
	sort.SliceStable(fs1Files, func(i, j int) bool {
		return fs1Files[i] < fs1Files[j]
	})

	sort.SliceStable(fs2Files, func(i, j int) bool {
		return fs2Files[i] < fs2Files[j]
	})

	return cmp.Equal(fs1Files, fs2Files) && fs1.Base() == fs2.Base()
})

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
		name         string
		class        plugins.Class
		cfg          *config.Cfg
		pluginPaths  []string
		want         []*plugins.Plugin
		pluginErrors map[string]*plugins.Error
	}{
		{
			name:        "Load a Core plugin",
			class:       plugins.Core,
			cfg:         &config.Cfg{},
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
					Module:  "app/plugins/datasource/cloudwatch/module",
					BaseURL: "public/app/plugins/datasource/cloudwatch",
					FS: plugins.NewLocalFS(
						filesInDir(t, filepath.Join(corePluginDir, "app/plugins/datasource/cloudwatch")),
						filepath.Join(corePluginDir, "app/plugins/datasource/cloudwatch")),
					Signature: plugins.SignatureInternal,
					Class:     plugins.Core,
				},
			},
		},
		{
			name:        "Load a Bundled plugin",
			class:       plugins.Bundled,
			cfg:         &config.Cfg{},
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
					Module:  "plugins/test-datasource/module",
					BaseURL: "public/plugins/test-datasource",
					FS: plugins.NewLocalFS(
						filesInDir(t, filepath.Join(parentDir, "testdata/valid-v2-signature/plugin/")),
						filepath.Join(parentDir, "testdata/valid-v2-signature/plugin/"),
					),
					Signature:     "valid",
					SignatureType: plugins.GrafanaSignature,
					SignatureOrg:  "Grafana Labs",
					Class:         plugins.Bundled,
				},
			},
		}, {
			name:        "Load plugin with symbolic links",
			class:       plugins.External,
			cfg:         &config.Cfg{},
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
					Class:   plugins.External,
					Module:  "plugins/test-app/module",
					BaseURL: "public/plugins/test-app",
					FS: plugins.NewLocalFS(
						map[string]struct{}{
							filepath.Join(parentDir, "testdata/includes-symlinks", "/MANIFEST.txt"):                {},
							filepath.Join(parentDir, "testdata/includes-symlinks", "dashboards/connections.json"):  {},
							filepath.Join(parentDir, "testdata/includes-symlinks", "dashboards/extra/memory.json"): {},
							filepath.Join(parentDir, "testdata/includes-symlinks", "plugin.json"):                  {},
							filepath.Join(parentDir, "testdata/includes-symlinks", "symlink_to_txt"):               {},
							filepath.Join(parentDir, "testdata/includes-symlinks", "text.txt"):                     {},
						},
						filepath.Join(parentDir, "testdata/includes-symlinks"),
					),
					Signature:     "valid",
					SignatureType: plugins.GrafanaSignature,
					SignatureOrg:  "Grafana Labs",
				},
			},
		}, {
			name:  "Load an unsigned plugin (development)",
			class: plugins.External,
			cfg: &config.Cfg{
				DevMode: true,
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
					Class:   plugins.External,
					Module:  "plugins/test-datasource/module",
					BaseURL: "public/plugins/test-datasource",
					FS: plugins.NewLocalFS(
						filesInDir(t, filepath.Join(parentDir, "testdata/unsigned-datasource/plugin")),
						filepath.Join(parentDir, "testdata/unsigned-datasource/plugin"),
					),
					Signature: "unsigned",
				},
			},
		}, {
			name:        "Load an unsigned plugin (production)",
			class:       plugins.External,
			cfg:         &config.Cfg{},
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
			cfg: &config.Cfg{
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
					Class:   plugins.External,
					Module:  "plugins/test-datasource/module",
					BaseURL: "public/plugins/test-datasource",
					FS: plugins.NewLocalFS(
						filesInDir(t, filepath.Join(parentDir, "testdata/unsigned-datasource/plugin")),
						filepath.Join(parentDir, "testdata/unsigned-datasource/plugin"),
					),
					Signature: plugins.SignatureUnsigned,
				},
			},
		},
		{
			name:        "Load a plugin with v1 manifest should return signatureInvalid",
			class:       plugins.External,
			cfg:         &config.Cfg{},
			pluginPaths: []string{"../testdata/lacking-files"},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test-datasource": {
					PluginID:  "test-datasource",
					ErrorCode: "signatureInvalid",
				},
			},
		},
		{
			name:  "Load a plugin with v1 manifest using PluginsAllowUnsigned config (production) should return signatureInvali",
			class: plugins.External,
			cfg: &config.Cfg{
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{"../testdata/lacking-files"},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test-datasource": {
					PluginID:  "test-datasource",
					ErrorCode: "signatureInvalid",
				},
			},
		},
		{
			name:  "Load a plugin with manifest which has a file not found in plugin folder",
			class: plugins.External,
			cfg: &config.Cfg{
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
			cfg: &config.Cfg{
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
			cfg: &config.Cfg{
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
					FS: plugins.NewLocalFS(map[string]struct{}{
						filepath.Join(parentDir, "testdata/test-app-with-includes", "dashboards/memory.json"): {},
						filepath.Join(parentDir, "testdata/test-app-with-includes", "plugin.json"):            {},
					}, filepath.Join(parentDir, "testdata/test-app-with-includes")),
					Class:     plugins.External,
					Signature: plugins.SignatureUnsigned,
					Module:    "plugins/test-app/module",
					BaseURL:   "public/plugins/test-app",
				},
			},
		},
	}
	for _, tt := range tests {
		reg := fakes.NewFakePluginRegistry()
		storage := fakes.NewFakePluginStorage()
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procMgr := fakes.NewFakeProcessManager()
		l := newLoader(tt.cfg, func(l *Loader) {
			l.pluginRegistry = reg
			l.pluginStorage = storage
			l.processManager = procMgr
			l.pluginInitializer = initializer.New(tt.cfg, procPrvdr, &fakes.FakeLicensingService{})
		})

		t.Run(tt.name, func(t *testing.T) {
			got, err := l.Load(context.Background(), sources.NewLocalSource(tt.class, tt.pluginPaths))
			require.NoError(t, err)
			if !cmp.Equal(got, tt.want, compareOpts...) {
				t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, tt.want, compareOpts...))
			}

			pluginErrs := l.PluginErrors()
			require.Equal(t, len(tt.pluginErrors), len(pluginErrs))
			for _, pluginErr := range pluginErrs {
				require.Equal(t, tt.pluginErrors[pluginErr.PluginID], pluginErr)
			}

			verifyState(t, tt.want, reg, procPrvdr, storage, procMgr)
		})
	}
}

func TestLoader_Load_CustomSource(t *testing.T) {
	t.Run("Load a plugin", func(t *testing.T) {
		parentDir, err := filepath.Abs("../")
		if err != nil {
			t.Errorf("could not construct absolute path of current dir")
			return
		}

		cfg := &config.Cfg{
			PluginsCDNURLTemplate: "https://cdn.example.com",
			PluginSettings: setting.PluginSettings{
				"grafana-worldmap-panel": {"cdn": "true"},
			},
		}

		pluginPaths := []string{"../testdata/cdn"}
		expected := []*plugins.Plugin{{
			JSONData: plugins.JSONData{
				ID:   "grafana-worldmap-panel",
				Type: "panel",
				Name: "Worldmap Panel",
				Info: plugins.Info{
					Version: "0.3.3",
					Links: []plugins.InfoLink{
						{Name: "Project site", URL: "https://github.com/grafana/worldmap-panel"},
						{Name: "MIT License", URL: "https://github.com/grafana/worldmap-panel/blob/master/LICENSE"},
					},
					Logos: plugins.Logos{
						// Path substitution
						Small: "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/images/worldmap_logo.svg",
						Large: "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/images/worldmap_logo.svg",
					},
					Screenshots: []plugins.Screenshots{
						{
							Name: "World",
							Path: "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/images/worldmap-world.png",
						},
						{
							Name: "USA",
							Path: "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/images/worldmap-usa.png",
						},
						{
							Name: "Light Theme",
							Path: "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/images/worldmap-light-theme.png",
						},
					},
				},
				Dependencies: plugins.Dependencies{
					GrafanaVersion: "3.x.x",
					Plugins:        []plugins.Dependency{},
				},
			},
			FS: plugins.NewLocalFS(map[string]struct{}{
				filepath.Join(parentDir, "testdata/cdn/plugin", "plugin.json"): {},
			}, filepath.Join(parentDir, "testdata/cdn/plugin")),
			Class:     plugins.Bundled,
			Signature: plugins.SignatureValid,
			BaseURL:   "plugin-cdn/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel",
			Module:    "plugin-cdn/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/module",
		}}

		l := newLoader(cfg)
		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.Bundled
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return pluginPaths
			},
			DefaultSignatureFunc: func(ctx context.Context) (plugins.Signature, bool) {
				return plugins.Signature{
					Status: plugins.SignatureValid,
				}, true
			},
		})

		require.NoError(t, err)
		if !cmp.Equal(got, expected, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
		}
	})
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

func TestLoader_Load_MultiplePlugins(t *testing.T) {
	parentDir, err := filepath.Abs("../")
	if err != nil {
		t.Errorf("could not construct absolute path of current dir")
		return
	}

	t.Run("Load multiple", func(t *testing.T) {
		tests := []struct {
			name            string
			cfg             *config.Cfg
			pluginPaths     []string
			appURL          string
			existingPlugins map[string]struct{}
			want            []*plugins.Plugin
			pluginErrors    map[string]*plugins.Error
		}{
			{
				name:   "Load multiple plugins (broken, valid, unsigned)",
				cfg:    &config.Cfg{},
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
						Class:   plugins.External,
						Module:  "plugins/test-datasource/module",
						BaseURL: "public/plugins/test-datasource",
						FS: plugins.NewLocalFS(map[string]struct{}{
							filepath.Join(parentDir, "testdata/valid-v2-pvt-signature/plugin/plugin.json"):  {},
							filepath.Join(parentDir, "testdata/valid-v2-pvt-signature/plugin/MANIFEST.txt"): {},
						}, filepath.Join(parentDir, "testdata/valid-v2-pvt-signature/plugin")),
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
			reg := fakes.NewFakePluginRegistry()
			storage := fakes.NewFakePluginStorage()
			procPrvdr := fakes.NewFakeBackendProcessProvider()
			procMgr := fakes.NewFakeProcessManager()
			l := newLoader(tt.cfg, func(l *Loader) {
				l.pluginRegistry = reg
				l.pluginStorage = storage
				l.processManager = procMgr
				l.pluginInitializer = initializer.New(tt.cfg, procPrvdr, fakes.NewFakeLicensingService())
			})
			t.Run(tt.name, func(t *testing.T) {
				origAppURL := setting.AppUrl
				t.Cleanup(func() {
					setting.AppUrl = origAppURL
				})
				setting.AppUrl = tt.appURL

				got, err := l.Load(context.Background(), &fakes.FakePluginSource{
					PluginClassFunc: func(ctx context.Context) plugins.Class {
						return plugins.External
					},
					PluginURIsFunc: func(ctx context.Context) []string {
						return tt.pluginPaths
					},
				})
				require.NoError(t, err)
				sort.SliceStable(got, func(i, j int) bool {
					return got[i].ID < got[j].ID
				})
				if !cmp.Equal(got, tt.want, compareOpts...) {
					t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, tt.want, compareOpts...))
				}
				pluginErrs := l.PluginErrors()
				require.Equal(t, len(tt.pluginErrors), len(pluginErrs))
				for _, pluginErr := range pluginErrs {
					require.Equal(t, tt.pluginErrors[pluginErr.PluginID], pluginErr)
				}
				verifyState(t, tt.want, reg, procPrvdr, storage, procMgr)
			})
		}
	})
}

func TestLoader_Load_RBACReady(t *testing.T) {
	pluginDir, err := filepath.Abs("../testdata/test-app-with-roles")
	if err != nil {
		t.Errorf("could not construct absolute path of current dir")
		return
	}

	tests := []struct {
		name            string
		cfg             *config.Cfg
		pluginPaths     []string
		appURL          string
		existingPlugins map[string]struct{}
		want            []*plugins.Plugin
	}{
		{
			name:        "Load plugin defining one RBAC role",
			cfg:         &config.Cfg{},
			appURL:      "http://localhost:3000",
			pluginPaths: []string{"../testdata/test-app-with-roles"},
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
							Description: "Test App",
							Version:     "1.0.0",
							Links:       []plugins.InfoLink{},
							Logos: plugins.Logos{
								Small: "public/img/icn-app.svg",
								Large: "public/img/icn-app.svg",
							},
							Updated: "2015-02-10",
						},
						Dependencies: plugins.Dependencies{
							GrafanaVersion:    "*",
							GrafanaDependency: ">=8.0.0",
							Plugins:           []plugins.Dependency{},
						},
						Includes: []*plugins.Includes{},
						Roles: []plugins.RoleRegistration{
							{
								Role: plugins.Role{
									Name:        "Reader",
									Description: "View everything in the test-app plugin",
									Permissions: []plugins.Permission{
										{Action: "plugins.app:access", Scope: "plugins.app:id:test-app"},
										{Action: "test-app.resource:read", Scope: "resources:*"},
										{Action: "test-app.otherresource:toggle"},
									},
								},
								Grants: []string{"Admin"},
							},
						},
						Backend: false,
					},
					FS: plugins.NewLocalFS(map[string]struct{}{
						filepath.Join(pluginDir, "plugin.json"):  {},
						filepath.Join(pluginDir, "MANIFEST.txt"): {},
					}, pluginDir),
					Class:         plugins.External,
					Signature:     plugins.SignatureValid,
					SignatureType: plugins.PrivateSignature,
					SignatureOrg:  "gabrielmabille",
					Module:        "plugins/test-app/module",
					BaseURL:       "public/plugins/test-app",
				},
			},
		},
	}

	for _, tt := range tests {
		origAppURL := setting.AppUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
		})
		setting.AppUrl = "http://localhost:3000"
		reg := fakes.NewFakePluginRegistry()
		storage := fakes.NewFakePluginStorage()
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procMgr := fakes.NewFakeProcessManager()
		l := newLoader(tt.cfg, func(l *Loader) {
			l.pluginRegistry = reg
			l.pluginStorage = storage
			l.processManager = procMgr
			l.pluginInitializer = initializer.New(tt.cfg, procPrvdr, fakes.NewFakeLicensingService())
		})

		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.External
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return tt.pluginPaths
			},
		})
		require.NoError(t, err)

		if !cmp.Equal(got, tt.want, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, tt.want, compareOpts...))
		}
		pluginErrs := l.PluginErrors()
		require.Len(t, pluginErrs, 0)

		verifyState(t, tt.want, reg, procPrvdr, storage, procMgr)
	}
}

func TestLoader_Load_Signature_RootURL(t *testing.T) {
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
				FS: plugins.NewLocalFS(map[string]struct{}{
					filepath.Join(filepath.Join(parentDir, "/testdata/valid-v2-pvt-signature-root-url-uri/plugin"), "plugin.json"):  {},
					filepath.Join(filepath.Join(parentDir, "/testdata/valid-v2-pvt-signature-root-url-uri/plugin"), "MANIFEST.txt"): {},
				}, filepath.Join(parentDir, "/testdata/valid-v2-pvt-signature-root-url-uri/plugin")),
				Class:         plugins.External,
				Signature:     plugins.SignatureValid,
				SignatureType: plugins.PrivateSignature,
				SignatureOrg:  "Will Browne",
				Module:        "plugins/test-datasource/module",
				BaseURL:       "public/plugins/test-datasource",
			},
		}

		reg := fakes.NewFakePluginRegistry()
		storage := fakes.NewFakePluginStorage()
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procMgr := fakes.NewFakeProcessManager()
		l := newLoader(&config.Cfg{}, func(l *Loader) {
			l.pluginRegistry = reg
			l.pluginStorage = storage
			l.processManager = procMgr
			l.pluginInitializer = initializer.New(&config.Cfg{}, procPrvdr, fakes.NewFakeLicensingService())
		})
		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.External
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return paths
			},
		})
		require.NoError(t, err)

		if !cmp.Equal(got, expected, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
		}
		verifyState(t, expected, reg, procPrvdr, storage, procMgr)
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
				FS:            plugins.NewLocalFS(filesInDir(t, pluginDir), pluginDir),
				Class:         plugins.External,
				Signature:     plugins.SignatureValid,
				SignatureType: plugins.GrafanaSignature,
				SignatureOrg:  "Grafana Labs",
				Module:        "plugins/test-app/module",
				BaseURL:       "public/plugins/test-app",
			},
		}

		reg := fakes.NewFakePluginRegistry()
		storage := fakes.NewFakePluginStorage()
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procMgr := fakes.NewFakeProcessManager()
		l := newLoader(&config.Cfg{}, func(l *Loader) {
			l.pluginRegistry = reg
			l.pluginStorage = storage
			l.processManager = procMgr
			l.pluginInitializer = initializer.New(&config.Cfg{}, procPrvdr, fakes.NewFakeLicensingService())
		})
		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.External
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return []string{pluginDir, pluginDir}
			},
		})
		require.NoError(t, err)

		if !cmp.Equal(got, expected, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
		}

		verifyState(t, expected, reg, procPrvdr, storage, procMgr)
	})
}

func TestLoader_Load_SkipUninitializedPlugins(t *testing.T) {
	t.Run("Load duplicate plugin folders", func(t *testing.T) {
		pluginDir1, err := filepath.Abs("../testdata/test-app")
		if err != nil {
			t.Errorf("could not construct absolute path of plugin dir")
			return
		}
		pluginDir2, err := filepath.Abs("../testdata/valid-v2-signature")
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
				FS:            plugins.NewLocalFS(filesInDir(t, pluginDir1), pluginDir1),
				Class:         plugins.External,
				Signature:     plugins.SignatureValid,
				SignatureType: plugins.GrafanaSignature,
				SignatureOrg:  "Grafana Labs",
				Module:        "plugins/test-app/module",
				BaseURL:       "public/plugins/test-app",
			},
		}

		reg := fakes.NewFakePluginRegistry()
		storage := fakes.NewFakePluginStorage()
		// Cause an initialization error
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procPrvdr.RejectID = "test-datasource"
		procMgr := fakes.NewFakeProcessManager()
		l := newLoader(&config.Cfg{}, func(l *Loader) {
			l.pluginRegistry = reg
			l.pluginStorage = storage
			l.processManager = procMgr
			l.pluginInitializer = initializer.New(&config.Cfg{}, procPrvdr, fakes.NewFakeLicensingService())
		})
		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.External
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return []string{pluginDir1, pluginDir2}
			},
		})
		require.NoError(t, err)

		if !cmp.Equal(got, expected, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
		}

		verifyState(t, expected, reg, procPrvdr, storage, procMgr)
	})
}

func TestLoader_Load_NestedPlugins(t *testing.T) {
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
		Module:  "plugins/test-datasource/module",
		BaseURL: "public/plugins/test-datasource",
		FS: plugins.NewLocalFS(filesInDir(t, filepath.Join(rootDir, "testdata/nested-plugins/parent")),
			filepath.Join(rootDir, "testdata/nested-plugins/parent")),
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
		Module:  "plugins/test-panel/module",
		BaseURL: "public/plugins/test-panel",
		FS: plugins.NewLocalFS(filesInDir(t, filepath.Join(rootDir, "testdata/nested-plugins/parent/nested")),
			filepath.Join(rootDir, "testdata/nested-plugins/parent/nested")),
		Signature:     plugins.SignatureValid,
		SignatureType: plugins.GrafanaSignature,
		SignatureOrg:  "Grafana Labs",
		Class:         plugins.External,
	}

	parent.Children = []*plugins.Plugin{child}
	child.Parent = parent

	t.Run("Load nested External plugins", func(t *testing.T) {
		reg := fakes.NewFakePluginRegistry()
		storage := fakes.NewFakePluginStorage()
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procMgr := fakes.NewFakeProcessManager()
		l := newLoader(&config.Cfg{}, func(l *Loader) {
			l.pluginRegistry = reg
			l.pluginStorage = storage
			l.processManager = procMgr
			l.pluginInitializer = initializer.New(&config.Cfg{}, procPrvdr, fakes.NewFakeLicensingService())
		})

		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.External
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return []string{"../testdata/nested-plugins"}
			},
		})
		require.NoError(t, err)

		// to ensure we can compare with expected
		sort.SliceStable(got, func(i, j int) bool {
			return got[i].ID < got[j].ID
		})

		expected := []*plugins.Plugin{parent, child}
		if !cmp.Equal(got, expected, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
		}

		verifyState(t, expected, reg, procPrvdr, storage, procMgr)

		t.Run("Load will exclude plugins that already exist", func(t *testing.T) {
			got, err := l.Load(context.Background(), &fakes.FakePluginSource{
				PluginClassFunc: func(ctx context.Context) plugins.Class {
					return plugins.External
				},
				PluginURIsFunc: func(ctx context.Context) []string {
					return []string{"../testdata/nested-plugins"}
				},
			})
			require.NoError(t, err)

			// to ensure we can compare with expected
			sort.SliceStable(got, func(i, j int) bool {
				return got[i].ID < got[j].ID
			})

			if !cmp.Equal(got, []*plugins.Plugin{}, compareOpts...) {
				t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
			}

			verifyState(t, expected, reg, procPrvdr, storage, procMgr)
		})
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
			Module:  "plugins/myorgid-simple-app/module",
			BaseURL: "public/plugins/myorgid-simple-app",
			FS: plugins.NewLocalFS(filesInDir(t, filepath.Join(rootDir, "testdata/app-with-child/dist")),
				filepath.Join(rootDir, "testdata/app-with-child/dist")),
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
			Module:  "plugins/myorgid-simple-app/child/module",
			BaseURL: "public/plugins/myorgid-simple-app",
			FS: plugins.NewLocalFS(filesInDir(t, filepath.Join(rootDir, "testdata/app-with-child/dist/child")),
				filepath.Join(rootDir, "testdata/app-with-child/dist/child")),
			IncludedInAppID: parent.ID,
			Signature:       plugins.SignatureValid,
			SignatureType:   plugins.GrafanaSignature,
			SignatureOrg:    "Grafana Labs",
			Class:           plugins.External,
		}

		parent.Children = []*plugins.Plugin{child}
		child.Parent = parent
		expected := []*plugins.Plugin{parent, child}

		reg := fakes.NewFakePluginRegistry()
		storage := fakes.NewFakePluginStorage()
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procMgr := fakes.NewFakeProcessManager()
		l := newLoader(&config.Cfg{}, func(l *Loader) {
			l.pluginRegistry = reg
			l.pluginStorage = storage
			l.processManager = procMgr
			l.pluginInitializer = initializer.New(&config.Cfg{}, procPrvdr, fakes.NewFakeLicensingService())
		})
		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.External
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return []string{"../testdata/app-with-child"}
			},
		})
		require.NoError(t, err)

		// to ensure we can compare with expected
		sort.SliceStable(got, func(i, j int) bool {
			return got[i].ID < got[j].ID
		})

		if !cmp.Equal(got, expected, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
		}

		verifyState(t, expected, reg, procPrvdr, storage, procMgr)
	})
}

func Test_setPathsBasedOnApp(t *testing.T) {
	t.Run("When setting paths based on core plugin on Windows", func(t *testing.T) {
		child := &plugins.Plugin{
			FS: fakes.NewFakePluginFiles("c:\\grafana\\public\\app\\plugins\\app\\testdata-app\\datasources\\datasource"),
		}
		parent := &plugins.Plugin{
			JSONData: plugins.JSONData{
				Type: plugins.App,
				ID:   "testdata-app",
			},
			Class:   plugins.Core,
			FS:      fakes.NewFakePluginFiles("c:\\grafana\\public\\app\\plugins\\app\\testdata-app"),
			BaseURL: "public/app/plugins/app/testdata-app",
		}

		configureAppChildPlugin(parent, child)

		require.Equal(t, "app/plugins/app/testdata-app/datasources/datasource/module", child.Module)
		require.Equal(t, "testdata-app", child.IncludedInAppID)
		require.Equal(t, "public/app/plugins/app/testdata-app", child.BaseURL)
	})
}

func newLoader(cfg *config.Cfg, cbs ...func(loader *Loader)) *Loader {
	l := New(cfg, &fakes.FakeLicensingService{}, signature.NewUnsignedAuthorizer(cfg), fakes.NewFakePluginRegistry(),
		fakes.NewFakeBackendProcessProvider(), fakes.NewFakeProcessManager(), fakes.NewFakePluginStorage(),
		fakes.NewFakeRoleRegistry(), assetpath.ProvideService(pluginscdn.ProvideService(cfg)), finder.NewLocalFinder())

	for _, cb := range cbs {
		cb(l)
	}

	return l
}

func verifyState(t *testing.T, ps []*plugins.Plugin, reg *fakes.FakePluginRegistry,
	procPrvdr *fakes.FakeBackendProcessProvider, storage *fakes.FakePluginStorage, procMngr *fakes.FakeProcessManager) {
	t.Helper()

	for _, p := range ps {
		if !cmp.Equal(p, reg.Store[p.ID], compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(p, reg.Store[p.ID], compareOpts...))
		}

		if p.Backend {
			require.Equal(t, 1, procPrvdr.Requested[p.ID])
			require.Equal(t, 1, procPrvdr.Invoked[p.ID])
		} else {
			require.Zero(t, procPrvdr.Requested[p.ID])
			require.Zero(t, procPrvdr.Invoked[p.ID])
		}

		_, exists := storage.Store[p.ID]
		if p.IsExternalPlugin() {
			require.True(t, exists)
		} else {
			require.False(t, exists)
		}

		require.Equal(t, 1, procMngr.Started[p.ID])
		require.Zero(t, procMngr.Stopped[p.ID])
	}
}

func filesInDir(t *testing.T, dir string) map[string]struct{} {
	files, err := collectFilesWithin(dir)
	if err != nil {
		t.Logf("Could not collect plugin file info. Err: %v", err)
		return map[string]struct{}{}
	}
	return files
}

func collectFilesWithin(dir string) (map[string]struct{}, error) {
	files := map[string]struct{}{}
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// skip directories
		if info.IsDir() {
			return nil
		}

		// verify that file is within plugin directory
		//file, err := filepath.Rel(dir, path)
		//if err != nil {
		//	return err
		//}
		//if strings.HasPrefix(file, ".."+string(filepath.Separator)) {
		//	return fmt.Errorf("file '%s' not inside of plugin directory", file)
		//}

		files[path] = struct{}{}
		return nil
	})

	return files, err
}
