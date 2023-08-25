package loader

import (
	"context"
	"errors"
	"path/filepath"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/termination"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/services/org"
)

var compareOpts = []cmp.Option{cmpopts.IgnoreFields(plugins.Plugin{}, "client", "log", "mu"), fsComparer}

var fsComparer = cmp.Comparer(func(fs1 plugins.FS, fs2 plugins.FS) bool {
	fs1Files, err := fs1.Files()
	if err != nil {
		panic(err)
	}
	fs2Files, err := fs2.Files()
	if err != nil {
		panic(err)
	}

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
		name        string
		class       plugins.Class
		cfg         *config.Cfg
		pluginPaths []string
		want        []*plugins.Plugin
	}{
		{
			name:        "Load a Core plugin",
			class:       plugins.ClassCore,
			cfg:         &config.Cfg{},
			pluginPaths: []string{filepath.Join(corePluginDir, "app/plugins/datasource/cloudwatch")},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "cloudwatch",
						Type: plugins.TypeDataSource,
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

					FS:        mustNewStaticFSForTests(t, filepath.Join(corePluginDir, "app/plugins/datasource/cloudwatch")),
					Signature: plugins.SignatureStatusInternal,
					Class:     plugins.ClassCore,
				},
			},
		},
		{
			name:        "Load a Bundled plugin",
			class:       plugins.ClassBundled,
			cfg:         &config.Cfg{},
			pluginPaths: []string{"../testdata/valid-v2-signature"},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "test-datasource",
						Type: plugins.TypeDataSource,
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
					FS:            mustNewStaticFSForTests(t, filepath.Join(parentDir, "testdata/valid-v2-signature/plugin/")),
					Signature:     "valid",
					SignatureType: plugins.SignatureTypeGrafana,
					SignatureOrg:  "Grafana Labs",
					Class:         plugins.ClassBundled,
				},
			},
		}, {
			name:        "Load plugin with symbolic links",
			class:       plugins.ClassExternal,
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
								Role: org.RoleViewer,
								Slug: "nginx-connections",
							},
							{
								Name: "Nginx Memory",
								Path: "dashboards/memory.json",
								Type: "dashboard",
								Role: org.RoleViewer,
								Slug: "nginx-memory",
							},
							{
								Name: "Nginx Panel",
								Type: string(plugins.TypePanel),
								Role: org.RoleViewer,
								Slug: "nginx-panel"},
							{
								Name: "Nginx Datasource",
								Type: string(plugins.TypeDataSource),
								Role: org.RoleViewer,
								Slug: "nginx-datasource",
							},
						},
					},
					Class:         plugins.ClassExternal,
					Module:        "plugins/test-app/module",
					BaseURL:       "public/plugins/test-app",
					FS:            mustNewStaticFSForTests(t, filepath.Join(parentDir, "testdata/includes-symlinks")),
					Signature:     "valid",
					SignatureType: plugins.SignatureTypeGrafana,
					SignatureOrg:  "Grafana Labs",
				},
			},
		}, {
			name:  "Load an unsigned plugin (development)",
			class: plugins.ClassExternal,
			cfg: &config.Cfg{
				DevMode: true,
			},
			pluginPaths: []string{"../testdata/unsigned-datasource"},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "test-datasource",
						Type: plugins.TypeDataSource,
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
						State:   plugins.ReleaseStateAlpha,
					},
					Class:     plugins.ClassExternal,
					Module:    "plugins/test-datasource/module",
					BaseURL:   "public/plugins/test-datasource",
					FS:        mustNewStaticFSForTests(t, filepath.Join(parentDir, "testdata/unsigned-datasource/plugin")),
					Signature: "unsigned",
				},
			},
		},
		{
			name:        "Load an unsigned plugin (production)",
			class:       plugins.ClassExternal,
			cfg:         &config.Cfg{},
			pluginPaths: []string{"../testdata/unsigned-datasource"},
			want:        []*plugins.Plugin{},
		},
		{
			name:  "Load an unsigned plugin using PluginsAllowUnsigned config (production)",
			class: plugins.ClassExternal,
			cfg: &config.Cfg{
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{"../testdata/unsigned-datasource"},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "test-datasource",
						Type: plugins.TypeDataSource,
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
						State:   plugins.ReleaseStateAlpha,
					},
					Class:     plugins.ClassExternal,
					Module:    "plugins/test-datasource/module",
					BaseURL:   "public/plugins/test-datasource",
					FS:        mustNewStaticFSForTests(t, filepath.Join(parentDir, "testdata/unsigned-datasource/plugin")),
					Signature: plugins.SignatureStatusUnsigned,
				},
			},
		},
		{
			name:        "Load a plugin with v1 manifest should return signatureInvalid",
			class:       plugins.ClassExternal,
			cfg:         &config.Cfg{},
			pluginPaths: []string{"../testdata/lacking-files"},
			want:        []*plugins.Plugin{},
		},
		{
			name:  "Load a plugin with v1 manifest using PluginsAllowUnsigned config (production) should return signatureInvali",
			class: plugins.ClassExternal,
			cfg: &config.Cfg{
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{"../testdata/lacking-files"},
			want:        []*plugins.Plugin{},
		},
		{
			name:  "Load a plugin with manifest which has a file not found in plugin folder",
			class: plugins.ClassExternal,
			cfg: &config.Cfg{
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{"../testdata/invalid-v2-missing-file"},
			want:        []*plugins.Plugin{},
		},
		{
			name:  "Load a plugin with file which is missing from the manifest",
			class: plugins.ClassExternal,
			cfg: &config.Cfg{
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{"../testdata/invalid-v2-extra-file"},
			want:        []*plugins.Plugin{},
		},
		{
			name:  "Load an app with includes",
			class: plugins.ClassExternal,
			cfg: &config.Cfg{
				PluginsAllowUnsigned: []string{"test-app"},
			},
			pluginPaths: []string{"../testdata/test-app-with-includes"},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "test-app",
						Type: plugins.TypeApp,
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
							{Name: "Nginx Memory", Path: "dashboards/memory.json", Type: "dashboard", Role: org.RoleViewer, Slug: "nginx-memory"},
							{Name: "Root Page (react)", Type: "page", Role: org.RoleViewer, Path: "/a/my-simple-app", DefaultNav: true, AddToNav: true, Slug: "root-page-react"},
						},
						Backend: false,
					},
					DefaultNavURL: "/plugins/test-app/page/root-page-react",
					FS:            mustNewStaticFSForTests(t, filepath.Join(parentDir, "testdata/test-app-with-includes")),
					Class:         plugins.ClassExternal,
					Signature:     plugins.SignatureStatusUnsigned,
					Module:        "plugins/test-app/module",
					BaseURL:       "public/plugins/test-app",
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			terminationStage, err := termination.New(tt.cfg, termination.Opts{})
			require.NoError(t, err)

			l := New(discovery.New(tt.cfg, discovery.Opts{}), bootstrap.New(tt.cfg, bootstrap.Opts{}),
				validation.New(tt.cfg, validation.Opts{}), initialization.New(tt.cfg, initialization.Opts{}),
				terminationStage)

			got, err := l.Load(context.Background(), sources.NewLocalSource(tt.class, tt.pluginPaths))
			require.NoError(t, err)
			if !cmp.Equal(got, tt.want, compareOpts...) {
				t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, tt.want, compareOpts...))
			}
		})
	}

	t.Run("Simple", func(t *testing.T) {
		src := &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.ClassExternal
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return []string{"http://example.com"}
			},
			DefaultSignatureFunc: func(ctx context.Context) (plugins.Signature, bool) {
				return plugins.Signature{}, false
			},
		}
		pluginJSON := plugins.JSONData{ID: "test-datasource", Type: plugins.TypeDataSource, Info: plugins.Info{Version: "1.0.0"}}
		plugin := &plugins.Plugin{
			JSONData:      pluginJSON,
			Signature:     plugins.SignatureStatusValid,
			SignatureType: plugins.SignatureTypeCommunity,
			FS:            plugins.NewFakeFS(),
		}

		var steps []string
		l := New(
			&fakes.FakeDiscoverer{
				DiscoverFunc: func(ctx context.Context, s plugins.PluginSource) ([]*plugins.FoundBundle, error) {
					require.Equal(t, src, s)
					steps = append(steps, "discover")
					return []*plugins.FoundBundle{{Primary: plugins.FoundPlugin{JSONData: pluginJSON}}}, nil
				},
			}, &fakes.FakeBootstrapper{
				BootstrapFunc: func(ctx context.Context, s plugins.PluginSource, b []*plugins.FoundBundle) ([]*plugins.Plugin, error) {
					require.True(t, len(b) == 1)
					require.Equal(t, b[0].Primary.JSONData, pluginJSON)
					require.Equal(t, src, s)

					steps = append(steps, "bootstrap")
					return []*plugins.Plugin{plugin}, nil
				},
			}, &fakes.FakeValidator{ValidateFunc: func(ctx context.Context, ps []*plugins.Plugin) ([]*plugins.Plugin, error) {
				require.Equal(t, []*plugins.Plugin{plugin}, ps)

				steps = append(steps, "validate")
				return ps, nil
			}},
			&fakes.FakeInitializer{
				IntializeFunc: func(ctx context.Context, ps []*plugins.Plugin) ([]*plugins.Plugin, error) {
					require.True(t, len(ps) == 1)
					require.Equal(t, ps[0].JSONData, pluginJSON)
					steps = append(steps, "initialize")
					return ps, nil
				},
			}, &fakes.FakeTerminator{})

		got, err := l.Load(context.Background(), src)
		require.NoError(t, err)
		require.Equal(t, []*plugins.Plugin{plugin}, got)
		require.Equal(t, []string{"discover", "bootstrap", "validate", "initialize"}, steps)
	})
}

func TestLoader_Unload(t *testing.T) {
	t.Run("Termination stage error is returned from Unload", func(t *testing.T) {
		plugin := &plugins.Plugin{
			JSONData: plugins.JSONData{ID: "test-datasource", Type: plugins.TypeDataSource, Info: plugins.Info{Version: "1.0.0"}},
		}
		tcs := []struct {
			expectedErr error
		}{
			{
				expectedErr: errors.New("plugin not found"),
			},
			{
				expectedErr: nil,
			},
		}

		for _, tc := range tcs {
			l := New(&fakes.FakeDiscoverer{},
				&fakes.FakeBootstrapper{},
				&fakes.FakeValidator{},
				&fakes.FakeInitializer{},
				&fakes.FakeTerminator{
					TerminateFunc: func(ctx context.Context, pluginID, version string) error {
						require.Equal(t, plugin.ID, pluginID)
						require.Equal(t, plugin.Info.Version, version)
						return tc.expectedErr
					},
				})

			err := l.Unload(context.Background(), plugin.ID, plugin.Info.Version)
			require.ErrorIs(t, err, tc.expectedErr)
		}
	})
}

func mustNewStaticFSForTests(t *testing.T, dir string) plugins.FS {
	sfs, err := plugins.NewStaticFS(plugins.NewLocalFS(dir))
	require.NoError(t, err)
	return sfs
}
