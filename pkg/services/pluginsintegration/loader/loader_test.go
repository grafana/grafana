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
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pipeline"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginerrs"
	"github.com/grafana/grafana/pkg/setting"
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
	tests := []struct {
		name         string
		class        plugins.Class
		cfg          *config.PluginManagementCfg
		pluginPaths  []string
		want         []*plugins.Plugin
		pluginErrors map[string]*plugins.Error
	}{
		{
			name:        "Load a Core plugin",
			class:       plugins.ClassCore,
			cfg:         &config.PluginManagementCfg{},
			pluginPaths: []string{filepath.Join(corePluginDir(t), "app/plugins/datasource/cloudwatch")},
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
							Keywords:    []string{"aws", "amazon"},
							Logos: plugins.Logos{
								Small: "public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png",
								Large: "public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png",
							},
							Links: []plugins.InfoLink{
								{Name: "Raise issue", URL: "https://github.com/grafana/grafana/issues/new"},
								{Name: "Documentation", URL: "https://grafana.com/docs/grafana/latest/datasources/aws-cloudwatch/"},
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
							Extensions: plugins.ExtensionsDependencies{
								ExposedComponents: []string{},
							},
						},
						Extensions: plugins.Extensions{
							AddedLinks:        []plugins.AddedLink{},
							AddedComponents:   []plugins.AddedComponent{},
							AddedFunctions:    []plugins.AddedFunction{},
							ExposedComponents: []plugins.ExposedComponent{},
							ExtensionPoints:   []plugins.ExtensionPoint{},
						},
						Category:     "cloud",
						Annotations:  true,
						Metrics:      true,
						Alerting:     true,
						Logs:         true,
						Backend:      true,
						QueryOptions: map[string]bool{"minInterval": true},
					},
					Module:    "core:plugin/cloudwatch",
					BaseURL:   "public/app/plugins/datasource/cloudwatch",
					FS:        mustNewStaticFSForTests(t, filepath.Join(corePluginDir(t), "app/plugins/datasource/cloudwatch")),
					Signature: plugins.SignatureStatusInternal,
					Class:     plugins.ClassCore,
				},
			},
		},
		{
			name:        "Load plugin with symbolic links",
			class:       plugins.ClassExternal,
			cfg:         &config.PluginManagementCfg{},
			pluginPaths: []string{filepath.Join(testDataDir(t), "symbolic-plugin-dirs")},
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
							Version:  "1.0.0",
							Updated:  "2015-02-10",
							Keywords: []string{"test"},
						},
						Dependencies: plugins.Dependencies{
							GrafanaVersion: "3.x.x",
							Plugins: []plugins.Dependency{
								{Type: "datasource", ID: "graphite", Name: "Graphite"},
								{Type: "panel", ID: "graph", Name: "Graph"},
							},
							Extensions: plugins.ExtensionsDependencies{
								ExposedComponents: []string{},
							},
						},
						Includes: []*plugins.Includes{
							{
								Name:   "Nginx Connections",
								Path:   "dashboards/connections.json",
								Type:   "dashboard",
								Role:   org.RoleViewer,
								Action: plugins.ActionAppAccess,
								Slug:   "nginx-connections",
							},
							{
								Name:   "Nginx Memory",
								Path:   "dashboards/memory.json",
								Type:   "dashboard",
								Role:   org.RoleViewer,
								Action: plugins.ActionAppAccess,
								Slug:   "nginx-memory",
							},
							{
								Name:   "Nginx Panel",
								Type:   string(plugins.TypePanel),
								Role:   org.RoleViewer,
								Action: plugins.ActionAppAccess,
								Slug:   "nginx-panel",
							},
							{
								Name:   "Nginx Datasource",
								Type:   string(plugins.TypeDataSource),
								Role:   org.RoleViewer,
								Action: plugins.ActionAppAccess,
								Slug:   "nginx-datasource",
							},
						},
						Extensions: plugins.Extensions{
							AddedLinks:      []plugins.AddedLink{},
							AddedComponents: []plugins.AddedComponent{},
							AddedFunctions:  []plugins.AddedFunction{},

							ExposedComponents: []plugins.ExposedComponent{},
							ExtensionPoints:   []plugins.ExtensionPoint{},
						},
					},
					Class:         plugins.ClassExternal,
					Module:        "public/plugins/test-app/module.js",
					BaseURL:       "public/plugins/test-app",
					FS:            mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "includes-symlinks")),
					Signature:     "valid",
					SignatureType: plugins.SignatureTypeGrafana,
					SignatureOrg:  "Grafana Labs",
				},
			},
		},
		{
			name:  "Load an unsigned plugin (development)",
			class: plugins.ClassExternal,
			cfg: &config.PluginManagementCfg{
				DevMode: true,
			},
			pluginPaths: []string{filepath.Join(testDataDir(t), "unsigned-datasource")},
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
							Extensions: plugins.ExtensionsDependencies{
								ExposedComponents: []string{},
							},
						},
						Extensions: plugins.Extensions{
							AddedLinks:      []plugins.AddedLink{},
							AddedComponents: []plugins.AddedComponent{},
							AddedFunctions:  []plugins.AddedFunction{},

							ExposedComponents: []plugins.ExposedComponent{},
							ExtensionPoints:   []plugins.ExtensionPoint{},
						},
						Backend: true,
						State:   plugins.ReleaseStateAlpha,
					},
					Class:     plugins.ClassExternal,
					Module:    "public/plugins/test-datasource/module.js",
					BaseURL:   "public/plugins/test-datasource",
					FS:        mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "unsigned-datasource/plugin")),
					Signature: "unsigned",
				},
			},
		},
		{
			name:        "Load an unsigned plugin (production)",
			class:       plugins.ClassExternal,
			cfg:         &config.PluginManagementCfg{},
			pluginPaths: []string{filepath.Join(testDataDir(t), "unsigned-datasource")},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test-datasource": {
					PluginID:        "test-datasource",
					SignatureStatus: plugins.SignatureStatusUnsigned,
				},
			},
		},
		{
			name:  "Load an unsigned plugin using PluginsAllowUnsigned config (production)",
			class: plugins.ClassExternal,
			cfg: &config.PluginManagementCfg{
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{filepath.Join(testDataDir(t), "unsigned-datasource")},
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
							Extensions: plugins.ExtensionsDependencies{
								ExposedComponents: []string{},
							},
						},
						Extensions: plugins.Extensions{
							AddedLinks:      []plugins.AddedLink{},
							AddedComponents: []plugins.AddedComponent{},
							AddedFunctions:  []plugins.AddedFunction{},

							ExposedComponents: []plugins.ExposedComponent{},
							ExtensionPoints:   []plugins.ExtensionPoint{},
						},
						Backend: true,
						State:   plugins.ReleaseStateAlpha,
					},
					Class:     plugins.ClassExternal,
					Module:    "public/plugins/test-datasource/module.js",
					BaseURL:   "public/plugins/test-datasource",
					FS:        mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "unsigned-datasource/plugin")),
					Signature: plugins.SignatureStatusUnsigned,
				},
			},
		},
		{
			name:        "Load a plugin with v1 manifest should return signatureInvalid",
			class:       plugins.ClassExternal,
			cfg:         &config.PluginManagementCfg{},
			pluginPaths: []string{filepath.Join(testDataDir(t), "lacking-files")},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test-datasource": {
					PluginID:        "test-datasource",
					SignatureStatus: plugins.SignatureStatusInvalid,
				},
			},
		},
		{
			name:  "Load a plugin with v1 manifest using PluginsAllowUnsigned config (production) should return signatureInvalid",
			class: plugins.ClassExternal,
			cfg: &config.PluginManagementCfg{
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{filepath.Join(testDataDir(t), "lacking-files")},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test-datasource": {
					PluginID:        "test-datasource",
					SignatureStatus: plugins.SignatureStatusInvalid,
				},
			},
		},
		{
			name:  "Load a plugin with manifest which has a file not found in plugin folder",
			class: plugins.ClassExternal,
			cfg: &config.PluginManagementCfg{
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{filepath.Join(testDataDir(t), "invalid-v2-missing-file")},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test-datasource": {
					PluginID:        "test-datasource",
					SignatureStatus: plugins.SignatureStatusModified,
				},
			},
		},
		{
			name:  "Load a plugin with file which is missing from the manifest",
			class: plugins.ClassExternal,
			cfg: &config.PluginManagementCfg{
				PluginsAllowUnsigned: []string{"test-datasource"},
			},
			pluginPaths: []string{filepath.Join(testDataDir(t), "invalid-v2-extra-file")},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test-datasource": {
					PluginID:        "test-datasource",
					SignatureStatus: plugins.SignatureStatusModified,
				},
			},
		},
		{
			name:  "Load an app with includes",
			class: plugins.ClassExternal,
			cfg: &config.PluginManagementCfg{
				PluginsAllowUnsigned: []string{"test-app"},
			},
			pluginPaths: []string{filepath.Join(testDataDir(t), "test-app-with-includes")},
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
							Updated:  "2015-02-10",
							Keywords: []string{"test"},
						},
						Dependencies: plugins.Dependencies{
							GrafanaDependency: ">=8.0.0",
							GrafanaVersion:    "*",
							Plugins:           []plugins.Dependency{},
							Extensions: plugins.ExtensionsDependencies{
								ExposedComponents: []string{},
							},
						},
						Extensions: plugins.Extensions{
							AddedLinks:      []plugins.AddedLink{},
							AddedComponents: []plugins.AddedComponent{},
							AddedFunctions:  []plugins.AddedFunction{},

							ExposedComponents: []plugins.ExposedComponent{},
							ExtensionPoints:   []plugins.ExtensionPoint{},
						},
						Includes: []*plugins.Includes{
							{Name: "Nginx Memory", Path: "dashboards/memory.json", Type: "dashboard", Role: org.RoleViewer, Action: plugins.ActionAppAccess, Slug: "nginx-memory"},
							{Name: "Root Page (react)", Type: "page", Role: org.RoleViewer, Action: plugins.ActionAppAccess, Path: "/a/my-simple-app", DefaultNav: true, AddToNav: true, Slug: "root-page-react"},
						},
						Backend: false,
					},
					DefaultNavURL: "/plugins/test-app/page/root-page-react",
					FS:            mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "test-app-with-includes")),
					Class:         plugins.ClassExternal,
					Signature:     plugins.SignatureStatusUnsigned,
					Module:        "public/plugins/test-app/module.js",
					BaseURL:       "public/plugins/test-app",
				},
			},
		},
	}
	for _, tt := range tests {
		reg := fakes.NewFakePluginRegistry()
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procMgr := fakes.NewFakeProcessManager()
		errTracker := pluginerrs.ProvideErrorTracker()
		l := newLoader(t, tt.cfg, reg, procMgr, procPrvdr, errTracker)

		t.Run(tt.name, func(t *testing.T) {
			got, err := l.Load(context.Background(), sources.NewLocalSource(tt.class, tt.pluginPaths))
			require.NoError(t, err)
			if !cmp.Equal(got, tt.want, compareOpts...) {
				t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, tt.want, compareOpts...))
			}

			pluginErrs := errTracker.Errors(context.Background())
			require.Equal(t, len(tt.pluginErrors), len(pluginErrs))
			for _, pluginErr := range pluginErrs {
				require.Equal(t, tt.pluginErrors[pluginErr.PluginID], pluginErr)
			}

			verifyState(t, tt.want, reg, procPrvdr, procMgr)
		})
	}
}

func TestLoader_Load_ExternalRegistration(t *testing.T) {
	t.Run("Load a plugin with service account registration", func(t *testing.T) {
		cfg := &config.PluginManagementCfg{
			PluginsAllowUnsigned: []string{"grafana-test-datasource"},
		}
		pluginPaths := []string{filepath.Join(testDataDir(t), "external-registration")}
		expected := []*plugins.Plugin{
			{
				JSONData: plugins.JSONData{
					ID:         "grafana-test-datasource",
					Type:       plugins.TypeDataSource,
					Name:       "Test",
					Backend:    true,
					Executable: "gpx_test_datasource",
					Info: plugins.Info{
						Author: plugins.InfoLink{
							Name: "Grafana Labs",
							URL:  "https://grafana.com",
						},
						Version: "1.0.0",
						Logos: plugins.Logos{
							Small: "public/plugins/grafana-test-datasource/img/ds.svg",
							Large: "public/plugins/grafana-test-datasource/img/ds.svg",
						},
						Updated:     "2023-08-03",
						Screenshots: []plugins.Screenshots{},
					},
					Dependencies: plugins.Dependencies{
						GrafanaVersion: "*",
						Plugins:        []plugins.Dependency{},
						Extensions: plugins.ExtensionsDependencies{
							ExposedComponents: []string{},
						},
					},
					Extensions: plugins.Extensions{
						AddedLinks:      []plugins.AddedLink{},
						AddedComponents: []plugins.AddedComponent{},
						AddedFunctions:  []plugins.AddedFunction{},

						ExposedComponents: []plugins.ExposedComponent{},
						ExtensionPoints:   []plugins.ExtensionPoint{},
					},
					IAM: &auth.IAM{
						Permissions: []auth.Permission{
							{
								Action: "read",
								Scope:  "datasource",
							},
						},
					},
				},
				FS:        mustNewStaticFSForTests(t, pluginPaths[0]),
				Class:     plugins.ClassExternal,
				Signature: plugins.SignatureStatusUnsigned,
				Module:    "public/plugins/grafana-test-datasource/module.js",
				BaseURL:   "public/plugins/grafana-test-datasource",
				ExternalService: &auth.ExternalService{
					ClientID:     "client-id",
					ClientSecret: "secretz",
				},
			},
		}

		backendFactoryProvider := fakes.NewFakeBackendProcessProvider()
		backendFactoryProvider.BackendFactoryFunc = func(ctx context.Context, plugin *plugins.Plugin) backendplugin.PluginFactoryFunc {
			return func(pluginID string, logger log.Logger, tracer trace.Tracer, env func() []string) (backendplugin.Plugin, error) {
				require.Equal(t, "grafana-test-datasource", pluginID)
				return &fakes.FakeBackendPlugin{}, nil
			}
		}

		l := newLoaderWithOpts(t, cfg, loaderDepOpts{
			authServiceRegistry: &fakes.FakeAuthService{
				Result: &auth.ExternalService{
					ClientID:     "client-id",
					ClientSecret: "secretz",
				},
			},
			backendFactoryProvider: backendFactoryProvider,
		})
		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.ClassExternal
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return pluginPaths
			},
			DefaultSignatureFunc: func(ctx context.Context) (plugins.Signature, bool) {
				return plugins.Signature{}, false
			},
		})

		require.NoError(t, err)
		if !cmp.Equal(got, expected, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
		}
	})
}

func TestLoader_Load_CustomSource(t *testing.T) {
	t.Run("Load a plugin", func(t *testing.T) {
		cfg := &config.PluginManagementCfg{
			PluginsCDNURLTemplate: "https://cdn.example.com",
			PluginSettings: setting.PluginSettings{
				"grafana-worldmap-panel": {"cdn": "true"},
			},
		}

		pluginPaths := []string{filepath.Join(testDataDir(t), "cdn")}
		expected := []*plugins.Plugin{{
			JSONData: plugins.JSONData{
				ID:   "grafana-worldmap-panel",
				Type: plugins.TypePanel,
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
					Extensions: plugins.ExtensionsDependencies{
						ExposedComponents: []string{},
					},
				},
				Extensions: plugins.Extensions{
					AddedLinks:      []plugins.AddedLink{},
					AddedComponents: []plugins.AddedComponent{},
					AddedFunctions:  []plugins.AddedFunction{},

					ExposedComponents: []plugins.ExposedComponent{},
					ExtensionPoints:   []plugins.ExtensionPoint{},
				},
			},
			FS:        mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "cdn/plugin")),
			Class:     plugins.ClassExternal,
			Signature: plugins.SignatureStatusValid,
			BaseURL:   "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel",
			Module:    "https://cdn.example.com/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/module.js",
		}}

		l := newLoader(t, cfg, fakes.NewFakePluginRegistry(), fakes.NewFakeProcessManager(), fakes.NewFakeBackendProcessProvider(), newFakeErrorTracker())
		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.ClassExternal
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return pluginPaths
			},
			DefaultSignatureFunc: func(ctx context.Context) (plugins.Signature, bool) {
				return plugins.Signature{
					Status: plugins.SignatureStatusValid,
				}, true
			},
		})

		require.NoError(t, err)
		if !cmp.Equal(got, expected, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
		}
	})
}

func TestLoader_Load_MultiplePlugins(t *testing.T) {
	t.Run("Load multiple", func(t *testing.T) {
		tests := []struct {
			name            string
			cfg             *config.PluginManagementCfg
			pluginPaths     []string
			existingPlugins map[string]struct{}
			want            []*plugins.Plugin
			pluginErrors    map[string]*plugins.Error
		}{
			{
				name: "Load multiple plugins (broken, valid, unsigned)",
				cfg: &config.PluginManagementCfg{
					GrafanaAppURL: "http://localhost:3000",
				},
				pluginPaths: []string{
					filepath.Join(testDataDir(t), "invalid-plugin-json"),    // test-app
					filepath.Join(testDataDir(t), "valid-v2-pvt-signature"), // test
					filepath.Join(testDataDir(t), "unsigned-panel"),         // test-panel
				},
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
								Extensions: plugins.ExtensionsDependencies{
									ExposedComponents: []string{},
								},
							},
							Extensions: plugins.Extensions{
								AddedLinks:      []plugins.AddedLink{},
								AddedComponents: []plugins.AddedComponent{},
								AddedFunctions:  []plugins.AddedFunction{},

								ExposedComponents: []plugins.ExposedComponent{},
								ExtensionPoints:   []plugins.ExtensionPoint{},
							},
							Backend:    true,
							Executable: "test",
							State:      plugins.ReleaseStateAlpha,
						},
						Class:         plugins.ClassExternal,
						Module:        "public/plugins/test-datasource/module.js",
						BaseURL:       "public/plugins/test-datasource",
						FS:            mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "valid-v2-pvt-signature/plugin")),
						Signature:     "valid",
						SignatureType: plugins.SignatureTypePrivate,
						SignatureOrg:  "Will Browne",
					},
				},
				pluginErrors: map[string]*plugins.Error{
					"test-panel": {
						PluginID:        "test-panel",
						SignatureStatus: plugins.SignatureStatusUnsigned,
					},
				},
			},
		}

		for _, tt := range tests {
			reg := fakes.NewFakePluginRegistry()
			procPrvdr := fakes.NewFakeBackendProcessProvider()
			procMgr := fakes.NewFakeProcessManager()
			errTracker := pluginerrs.ProvideErrorTracker()

			l := newLoader(t, tt.cfg, reg, procMgr, procPrvdr, errTracker)
			t.Run(tt.name, func(t *testing.T) {
				got, err := l.Load(context.Background(), &fakes.FakePluginSource{
					PluginClassFunc: func(ctx context.Context) plugins.Class {
						return plugins.ClassExternal
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
				pluginErrs := errTracker.Errors(context.Background())
				require.Equal(t, len(tt.pluginErrors), len(pluginErrs))
				for _, pluginErr := range pluginErrs {
					require.Equal(t, tt.pluginErrors[pluginErr.PluginID], pluginErr)
				}
				verifyState(t, tt.want, reg, procPrvdr, procMgr)
			})
		}
	})
}

func TestLoader_Load_RBACReady(t *testing.T) {
	tests := []struct {
		name            string
		cfg             *config.PluginManagementCfg
		pluginPaths     []string
		existingPlugins map[string]struct{}
		want            []*plugins.Plugin
	}{
		{
			name: "Load plugin defining one RBAC role",
			cfg: &config.PluginManagementCfg{
				GrafanaAppURL: "http://localhost:3000",
			},
			pluginPaths: []string{filepath.Join(testDataDir(t), "test-app-with-roles")},
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
							Description: "Test App",
							Version:     "1.0.0",
							Links:       []plugins.InfoLink{},
							Logos: plugins.Logos{
								Small: "public/img/icn-app.svg",
								Large: "public/img/icn-app.svg",
							},
							Updated:  "2015-02-10",
							Keywords: []string{"test"},
						},
						Dependencies: plugins.Dependencies{
							GrafanaVersion:    "*",
							GrafanaDependency: ">=8.0.0",
							Plugins:           []plugins.Dependency{},
							Extensions: plugins.ExtensionsDependencies{
								ExposedComponents: []string{},
							},
						},
						Extensions: plugins.Extensions{
							AddedLinks:      []plugins.AddedLink{},
							AddedComponents: []plugins.AddedComponent{},
							AddedFunctions:  []plugins.AddedFunction{},

							ExposedComponents: []plugins.ExposedComponent{},
							ExtensionPoints:   []plugins.ExtensionPoint{},
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
					FS:            mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "test-app-with-roles")),
					Class:         plugins.ClassExternal,
					Signature:     plugins.SignatureStatusValid,
					SignatureType: plugins.SignatureTypePrivate,
					SignatureOrg:  "gabrielmabille",
					Module:        "public/plugins/test-app/module.js",
					BaseURL:       "public/plugins/test-app",
				},
			},
		},
	}

	for _, tt := range tests {
		reg := fakes.NewFakePluginRegistry()
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procMgr := fakes.NewFakeProcessManager()
		l := newLoader(t, tt.cfg, reg, procMgr, procPrvdr, newFakeErrorTracker())

		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.ClassExternal
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return tt.pluginPaths
			},
		})
		require.NoError(t, err)

		if !cmp.Equal(got, tt.want, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, tt.want, compareOpts...))
		}

		verifyState(t, tt.want, reg, procPrvdr, procMgr)
	}
}

func TestLoader_Load_Signature_RootURL(t *testing.T) {
	t.Run("Private signature verification ignores trailing slash in root URL", func(t *testing.T) {
		const defaultAppURL = "http://localhost:3000/grafana"

		expected := []*plugins.Plugin{
			{
				JSONData: plugins.JSONData{
					ID:   "test-datasource",
					Type: plugins.TypeDataSource,
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
					State: plugins.ReleaseStateAlpha,
					Dependencies: plugins.Dependencies{GrafanaVersion: "*", Plugins: []plugins.Dependency{}, Extensions: plugins.ExtensionsDependencies{
						ExposedComponents: []string{},
					}},
					Extensions: plugins.Extensions{
						AddedLinks:      []plugins.AddedLink{},
						AddedComponents: []plugins.AddedComponent{},
						AddedFunctions:  []plugins.AddedFunction{},

						ExposedComponents: []plugins.ExposedComponent{},
						ExtensionPoints:   []plugins.ExtensionPoint{},
					},
					Backend:    true,
					Executable: "test",
				},
				FS:            mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "valid-v2-pvt-signature-root-url-uri/plugin")),
				Class:         plugins.ClassExternal,
				Signature:     plugins.SignatureStatusValid,
				SignatureType: plugins.SignatureTypePrivate,
				SignatureOrg:  "Will Browne",
				Module:        "public/plugins/test-datasource/module.js",
				BaseURL:       "public/plugins/test-datasource",
			},
		}

		reg := fakes.NewFakePluginRegistry()
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procMgr := fakes.NewFakeProcessManager()
		cfg := &config.PluginManagementCfg{GrafanaAppURL: defaultAppURL}
		l := newLoader(t, cfg, reg, procMgr, procPrvdr, newFakeErrorTracker())
		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.ClassExternal
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return []string{filepath.Join(testDataDir(t), "valid-v2-pvt-signature-root-url-uri")}
			},
		})
		require.NoError(t, err)

		if !cmp.Equal(got, expected, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
		}
		verifyState(t, expected, reg, procPrvdr, procMgr)
	})
}

func TestLoader_Load_DuplicatePlugins(t *testing.T) {
	t.Run("Load duplicate plugin folders", func(t *testing.T) {
		expected := []*plugins.Plugin{
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
							Small: "public/plugins/test-app/img/logo_small.png",
							Large: "public/plugins/test-app/img/logo_large.png",
						},
						Screenshots: []plugins.Screenshots{
							{Path: "public/plugins/test-app/img/screenshot1.png", Name: "img1"},
							{Path: "public/plugins/test-app/img/screenshot2.png", Name: "img2"},
						},
						Updated:  "2015-02-10",
						Keywords: []string{"test"},
					},
					Dependencies: plugins.Dependencies{
						GrafanaVersion: "3.x.x",
						Plugins: []plugins.Dependency{
							{Type: "datasource", ID: "graphite", Name: "Graphite"},
							{Type: "panel", ID: "graph", Name: "Graph"},
						},
						Extensions: plugins.ExtensionsDependencies{
							ExposedComponents: []string{},
						},
					},
					Extensions: plugins.Extensions{
						AddedLinks:      []plugins.AddedLink{},
						AddedComponents: []plugins.AddedComponent{},
						AddedFunctions:  []plugins.AddedFunction{},

						ExposedComponents: []plugins.ExposedComponent{},
						ExtensionPoints:   []plugins.ExtensionPoint{},
					},
					Includes: []*plugins.Includes{
						{Name: "Nginx Connections", Path: "dashboards/connections.json", Type: "dashboard", Role: org.RoleViewer, Action: plugins.ActionAppAccess, Slug: "nginx-connections"},
						{Name: "Nginx Memory", Path: "dashboards/memory.json", Type: "dashboard", Role: org.RoleViewer, Action: plugins.ActionAppAccess, Slug: "nginx-memory"},
						{Name: "Nginx Panel", Type: "panel", Role: org.RoleViewer, Action: plugins.ActionAppAccess, Slug: "nginx-panel"},
						{Name: "Nginx Datasource", Type: "datasource", Role: org.RoleViewer, Action: plugins.ActionAppAccess, Slug: "nginx-datasource"},
					},
					Backend: false,
				},
				FS:            mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "test-app")),
				Class:         plugins.ClassExternal,
				Signature:     plugins.SignatureStatusValid,
				SignatureType: plugins.SignatureTypeGrafana,
				SignatureOrg:  "Grafana Labs",
				Module:        "public/plugins/test-app/module.js",
				BaseURL:       "public/plugins/test-app",
			},
		}

		reg := fakes.NewFakePluginRegistry()
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procMgr := fakes.NewFakeProcessManager()
		cfg := &config.PluginManagementCfg{}
		l := newLoader(t, cfg, reg, procMgr, procPrvdr, newFakeErrorTracker())
		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.ClassExternal
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return []string{filepath.Join(testDataDir(t), "test-app"), filepath.Join(testDataDir(t), "test-app")}
			},
		})
		require.NoError(t, err)

		if !cmp.Equal(got, expected, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
		}

		verifyState(t, expected, reg, procPrvdr, procMgr)
	})
}

func TestLoader_Load_SkipUninitializedPlugins(t *testing.T) {
	t.Run("Load duplicate plugin folders", func(t *testing.T) {
		pluginDir1 := filepath.Join(testDataDir(t), "test-app")
		pluginDir2 := filepath.Join(testDataDir(t), "valid-v2-signature")

		expected := []*plugins.Plugin{
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
							Small: "public/plugins/test-app/img/logo_small.png",
							Large: "public/plugins/test-app/img/logo_large.png",
						},
						Screenshots: []plugins.Screenshots{
							{Path: "public/plugins/test-app/img/screenshot1.png", Name: "img1"},
							{Path: "public/plugins/test-app/img/screenshot2.png", Name: "img2"},
						},
						Updated:  "2015-02-10",
						Keywords: []string{"test"},
					},
					Dependencies: plugins.Dependencies{
						GrafanaVersion: "3.x.x",
						Plugins: []plugins.Dependency{
							{Type: "datasource", ID: "graphite", Name: "Graphite"},
							{Type: "panel", ID: "graph", Name: "Graph"},
						},
						Extensions: plugins.ExtensionsDependencies{
							ExposedComponents: []string{},
						},
					},
					Includes: []*plugins.Includes{
						{Name: "Nginx Connections", Path: "dashboards/connections.json", Type: "dashboard", Role: org.RoleViewer, Action: plugins.ActionAppAccess, Slug: "nginx-connections"},
						{Name: "Nginx Memory", Path: "dashboards/memory.json", Type: "dashboard", Role: org.RoleViewer, Action: plugins.ActionAppAccess, Slug: "nginx-memory"},
						{Name: "Nginx Panel", Type: "panel", Role: org.RoleViewer, Action: plugins.ActionAppAccess, Slug: "nginx-panel"},
						{Name: "Nginx Datasource", Type: "datasource", Role: org.RoleViewer, Action: plugins.ActionAppAccess, Slug: "nginx-datasource"},
					},
					Extensions: plugins.Extensions{
						AddedLinks:      []plugins.AddedLink{},
						AddedComponents: []plugins.AddedComponent{},
						AddedFunctions:  []plugins.AddedFunction{},

						ExposedComponents: []plugins.ExposedComponent{},
						ExtensionPoints:   []plugins.ExtensionPoint{},
					},
					Backend: false,
				},
				FS:            mustNewStaticFSForTests(t, pluginDir1),
				Class:         plugins.ClassExternal,
				Signature:     plugins.SignatureStatusValid,
				SignatureType: plugins.SignatureTypeGrafana,
				SignatureOrg:  "Grafana Labs",
				Module:        "public/plugins/test-app/module.js",
				BaseURL:       "public/plugins/test-app",
			},
		}

		reg := fakes.NewFakePluginRegistry()
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		// Cause an initialization error
		procPrvdr.BackendFactoryFunc = func(ctx context.Context, p *plugins.Plugin) backendplugin.PluginFactoryFunc {
			return func(pluginID string, _ log.Logger, _ trace.Tracer, _ func() []string) (backendplugin.Plugin, error) {
				if pluginID == "test-datasource" {
					return nil, errors.New("failed to initialize")
				}
				return &fakes.FakePluginClient{}, nil
			}
		}
		procMgr := fakes.NewFakeProcessManager()
		cfg := &config.PluginManagementCfg{}
		l := newLoader(t, cfg, reg, procMgr, procPrvdr, newFakeErrorTracker())
		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.ClassExternal
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return []string{pluginDir1, pluginDir2}
			},
		})
		require.NoError(t, err)

		if !cmp.Equal(got, expected, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
		}

		verifyState(t, expected, reg, procPrvdr, procMgr)
	})
}

func TestLoader_AngularClass(t *testing.T) {
	for _, tc := range []struct {
		name                   string
		class                  plugins.Class
		expAngularDetectionRun bool
	}{
		{
			name:                   "core plugin should skip angular detection",
			class:                  plugins.ClassCore,
			expAngularDetectionRun: false,
		},
		{
			name:                   "external plugin should run angular detection",
			class:                  plugins.ClassExternal,
			expAngularDetectionRun: true,
		},
		{
			name:                   "other-class plugin should run angular detection",
			class:                  "CDN", // (enterprise-only class)
			expAngularDetectionRun: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fakePluginSource := &fakes.FakePluginSource{
				PluginClassFunc: func(ctx context.Context) plugins.Class {
					return tc.class
				},
				PluginURIsFunc: func(ctx context.Context) []string {
					return []string{filepath.Join(testDataDir(t), "valid-v2-signature")}
				},
			}
			// if angularDetected = true, it means that the detection has run
			l := newLoaderWithOpts(t, &config.PluginManagementCfg{}, loaderDepOpts{
				angularInspector: angularinspector.AlwaysAngularFakeInspector,
			})
			p, err := l.Load(context.Background(), fakePluginSource)
			require.NoError(t, err)
			if tc.expAngularDetectionRun {
				require.Empty(t, p, "plugin shouldn't have been loaded")
			} else {
				require.Len(t, p, 1, "should load 1 plugin")
				require.False(t, p[0].Angular.Detected, "angular detection should not run")
			}
		})
	}
}

func TestLoader_Load_Angular(t *testing.T) {
	fakePluginSource := &fakes.FakePluginSource{
		PluginClassFunc: func(ctx context.Context) plugins.Class {
			return plugins.ClassExternal
		},
		PluginURIsFunc: func(ctx context.Context) []string {
			return []string{filepath.Join(testDataDir(t), "valid-v2-signature")}
		},
	}
	for _, cfgTc := range []struct {
		name string
		cfg  *config.PluginManagementCfg
	}{
		{name: "angular support enabled", cfg: &config.PluginManagementCfg{}},
		{name: "angular support disabled", cfg: &config.PluginManagementCfg{}},
	} {
		t.Run(cfgTc.name, func(t *testing.T) {
			for _, tc := range []struct {
				name             string
				angularInspector angularinspector.Inspector
				shouldLoad       bool
			}{
				{
					name:             "angular plugin",
					angularInspector: angularinspector.AlwaysAngularFakeInspector,
					// angular plugins should load only if allowed by the cfg
					shouldLoad: false,
				},
				{
					name:             "non angular plugin",
					angularInspector: angularinspector.NeverAngularFakeInspector,
					// non-angular plugins should always load
					shouldLoad: true,
				},
			} {
				t.Run(tc.name, func(t *testing.T) {
					l := newLoaderWithOpts(t, cfgTc.cfg, loaderDepOpts{angularInspector: tc.angularInspector})
					p, err := l.Load(context.Background(), fakePluginSource)
					require.NoError(t, err)
					if tc.shouldLoad {
						require.Len(t, p, 1, "plugin should have been loaded")
					} else {
						require.Empty(t, p, "plugin shouldn't have been loaded")
					}
				})
			}
		})
	}
}

func TestLoader_HideAngularDeprecation(t *testing.T) {
	fakePluginSource := &fakes.FakePluginSource{
		PluginClassFunc: func(ctx context.Context) plugins.Class {
			return plugins.ClassExternal
		},
		PluginURIsFunc: func(ctx context.Context) []string {
			return []string{filepath.Join(testDataDir(t), "valid-v2-signature")}
		},
	}
	for _, tc := range []struct {
		name string
		cfg  *config.PluginManagementCfg
	}{
		{name: "with plugin id in HideAngularDeprecation list", cfg: &config.PluginManagementCfg{
			HideAngularDeprecation: []string{"one-app", "two-panel", "test-datasource", "three-datasource"},
		}},
		{name: "without plugin id in HideAngularDeprecation list", cfg: &config.PluginManagementCfg{
			HideAngularDeprecation: []string{"one-app", "two-panel", "three-datasource"},
		}},
		{name: "with empty HideAngularDeprecation", cfg: &config.PluginManagementCfg{
			HideAngularDeprecation: nil,
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			l := newLoaderWithOpts(t, tc.cfg, loaderDepOpts{
				angularInspector: angularinspector.AlwaysAngularFakeInspector,
			})
			p, err := l.Load(context.Background(), fakePluginSource)
			require.NoError(t, err)
			require.Empty(t, p, "plugin shouldn't have been loaded")
		})
	}
}

func TestLoader_Load_NestedPlugins(t *testing.T) {
	parent := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID:   "test-datasource",
			Type: plugins.TypeDataSource,
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
				Extensions: plugins.ExtensionsDependencies{
					ExposedComponents: []string{},
				},
			},
			Extensions: plugins.Extensions{
				AddedLinks:      []plugins.AddedLink{},
				AddedComponents: []plugins.AddedComponent{},
				AddedFunctions:  []plugins.AddedFunction{},

				ExposedComponents: []plugins.ExposedComponent{},
				ExtensionPoints:   []plugins.ExtensionPoint{},
			},
			Backend: true,
		},
		Module:        "public/plugins/test-datasource/module.js",
		BaseURL:       "public/plugins/test-datasource",
		FS:            mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "nested-plugins/parent")),
		Signature:     plugins.SignatureStatusValid,
		SignatureType: plugins.SignatureTypeGrafana,
		SignatureOrg:  "Grafana Labs",
		Class:         plugins.ClassExternal,
	}

	child := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID:   "test-panel",
			Type: plugins.TypePanel,
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
				Extensions: plugins.ExtensionsDependencies{
					ExposedComponents: []string{},
				},
			},
			Extensions: plugins.Extensions{
				AddedLinks:      []plugins.AddedLink{},
				AddedComponents: []plugins.AddedComponent{},
				AddedFunctions:  []plugins.AddedFunction{},

				ExposedComponents: []plugins.ExposedComponent{},
				ExtensionPoints:   []plugins.ExtensionPoint{},
			},
		},
		Module:        "public/plugins/test-datasource/nested/module.js",
		BaseURL:       "public/plugins/test-datasource/nested",
		FS:            mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "nested-plugins/parent/nested")),
		Signature:     plugins.SignatureStatusValid,
		SignatureType: plugins.SignatureTypeGrafana,
		SignatureOrg:  "Grafana Labs",
		Class:         plugins.ClassExternal,
	}

	parent.Children = []*plugins.Plugin{child}
	child.Parent = parent

	t.Run("Load nested External plugins", func(t *testing.T) {
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procMgr := fakes.NewFakeProcessManager()
		reg := fakes.NewFakePluginRegistry()
		cfg := &config.PluginManagementCfg{}
		l := newLoader(t, cfg, reg, procMgr, procPrvdr, newFakeErrorTracker())

		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.ClassExternal
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return []string{filepath.Join(testDataDir(t), "nested-plugins")}
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

		verifyState(t, expected, reg, procPrvdr, procMgr)

		t.Run("Load will exclude plugins that already exist", func(t *testing.T) {
			got, err := l.Load(context.Background(), &fakes.FakePluginSource{
				PluginClassFunc: func(ctx context.Context) plugins.Class {
					return plugins.ClassExternal
				},
				PluginURIsFunc: func(ctx context.Context) []string {
					return []string{filepath.Join(testDataDir(t), "nested-plugins")}
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

			verifyState(t, expected, reg, procPrvdr, procMgr)
		})
	})

	t.Run("Plugin child field `IncludedInAppID` is set to parent app's plugin ID", func(t *testing.T) {
		parent := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "myorgid-simple-app",
				Type: plugins.TypeApp,
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
					Version:     "",
					Updated:     "",
					Keywords:    []string{"panel", "template"},
				},
				Dependencies: plugins.Dependencies{
					GrafanaVersion:    "7.0.0",
					GrafanaDependency: ">=7.0.0",
					Plugins:           []plugins.Dependency{},
					Extensions: plugins.ExtensionsDependencies{
						ExposedComponents: []string{},
					},
				},
				Includes: []*plugins.Includes{
					{
						Name:       "Root Page (react)",
						Path:       "/a/myorgid-simple-app",
						Type:       "page",
						Role:       org.RoleViewer,
						Action:     plugins.ActionAppAccess,
						AddToNav:   true,
						DefaultNav: true,
						Slug:       "root-page-react",
					},
					{
						Name:     "Root Page (Tab B)",
						Path:     "/a/myorgid-simple-app/?tab=b",
						Type:     "page",
						Role:     org.RoleViewer,
						Action:   plugins.ActionAppAccess,
						AddToNav: true,
						Slug:     "root-page-tab-b",
					},
					{
						Name:     "React Config",
						Path:     "/plugins/myorgid-simple-app/?page=page2",
						Type:     "page",
						Role:     org.RoleAdmin,
						AddToNav: true,
						Slug:     "react-config",
					},
					{
						Name:   "Streaming Example",
						Path:   "dashboards/streaming.json",
						Type:   "dashboard",
						Role:   org.RoleViewer,
						Action: plugins.ActionAppAccess,
						Slug:   "streaming-example",
					},
					{
						Name:   "Lots of Stats",
						Path:   "dashboards/stats.json",
						Type:   "dashboard",
						Role:   org.RoleViewer,
						Action: plugins.ActionAppAccess,
						Slug:   "lots-of-stats",
					},
				},
				Extensions: plugins.Extensions{
					AddedLinks:      []plugins.AddedLink{},
					AddedComponents: []plugins.AddedComponent{},
					AddedFunctions:  []plugins.AddedFunction{},

					ExposedComponents: []plugins.ExposedComponent{},
					ExtensionPoints:   []plugins.ExtensionPoint{},
				},
				Backend: false,
			},
			Module:        "public/plugins/myorgid-simple-app/module.js",
			BaseURL:       "public/plugins/myorgid-simple-app",
			FS:            mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "app-with-child/dist")),
			DefaultNavURL: "/plugins/myorgid-simple-app/page/root-page-react",
			Signature:     plugins.SignatureStatusValid,
			SignatureType: plugins.SignatureTypeGrafana,
			SignatureOrg:  "Grafana Labs",
			Class:         plugins.ClassExternal,
		}

		child := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:   "myorgid-simple-panel",
				Type: plugins.TypePanel,
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
						Small: "public/plugins/myorgid-simple-app/child/img/logo.svg",
						Large: "public/plugins/myorgid-simple-app/child/img/logo.svg",
					},
					Screenshots: []plugins.Screenshots{},
					Description: "Grafana Panel Plugin Template",
					Version:     "",
					Updated:     "",
					Keywords:    []string{"panel", "template"},
				},
				Dependencies: plugins.Dependencies{
					GrafanaDependency: ">=7.0.0",
					GrafanaVersion:    "*",
					Plugins:           []plugins.Dependency{},
					Extensions: plugins.ExtensionsDependencies{
						ExposedComponents: []string{},
					},
				},
				Extensions: plugins.Extensions{
					AddedLinks:      []plugins.AddedLink{},
					AddedComponents: []plugins.AddedComponent{},
					AddedFunctions:  []plugins.AddedFunction{},

					ExposedComponents: []plugins.ExposedComponent{},
					ExtensionPoints:   []plugins.ExtensionPoint{},
				},
			},
			Module:          "public/plugins/myorgid-simple-app/child/module.js",
			BaseURL:         "public/plugins/myorgid-simple-app/child",
			FS:              mustNewStaticFSForTests(t, filepath.Join(testDataDir(t), "app-with-child/dist/child")),
			IncludedInAppID: parent.ID,
			Signature:       plugins.SignatureStatusValid,
			SignatureType:   plugins.SignatureTypeGrafana,
			SignatureOrg:    "Grafana Labs",
			Class:           plugins.ClassExternal,
		}

		parent.Children = []*plugins.Plugin{child}
		child.Parent = parent
		expected := []*plugins.Plugin{parent, child}

		reg := fakes.NewFakePluginRegistry()
		procPrvdr := fakes.NewFakeBackendProcessProvider()
		procMgr := fakes.NewFakeProcessManager()
		cfg := &config.PluginManagementCfg{}
		l := newLoader(t, cfg, reg, procMgr, procPrvdr, newFakeErrorTracker())
		got, err := l.Load(context.Background(), &fakes.FakePluginSource{
			PluginClassFunc: func(ctx context.Context) plugins.Class {
				return plugins.ClassExternal
			},
			PluginURIsFunc: func(ctx context.Context) []string {
				return []string{filepath.Join(testDataDir(t), "app-with-child")}
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

		verifyState(t, expected, reg, procPrvdr, procMgr)
	})
}

type loaderDepOpts struct {
	angularInspector       angularinspector.Inspector
	authServiceRegistry    auth.ExternalServiceRegistry
	backendFactoryProvider plugins.BackendFactoryProvider
}

func newLoader(t *testing.T, cfg *config.PluginManagementCfg, reg registry.Service, proc process.Manager,
	backendFactory plugins.BackendFactoryProvider, errTracker pluginerrs.ErrorTracker,
) *Loader {
	assets := assetpath.ProvideService(cfg, pluginscdn.ProvideService(cfg))
	angularInspector := angularinspector.NewStaticInspector()

	terminate, err := pipeline.ProvideTerminationStage(cfg, reg, proc)
	require.NoError(t, err)

	return ProvideService(cfg, pipeline.ProvideDiscoveryStage(cfg,
		finder.NewLocalFinder(false), reg),
		pipeline.ProvideBootstrapStage(cfg, signature.DefaultCalculator(cfg), assets),
		pipeline.ProvideValidationStage(cfg, signature.NewValidator(signature.NewUnsignedAuthorizer(cfg)), angularInspector),
		pipeline.ProvideInitializationStage(cfg, reg, backendFactory, proc, &fakes.FakeAuthService{}, fakes.NewFakeRoleRegistry(), fakes.NewFakeActionSetRegistry(), fakes.NewFakePluginEnvProvider(), tracing.InitializeTracerForTest()),
		terminate, errTracker)
}

func newLoaderWithOpts(t *testing.T, cfg *config.PluginManagementCfg, opts loaderDepOpts) *Loader {
	assets := assetpath.ProvideService(cfg, pluginscdn.ProvideService(cfg))
	reg := fakes.NewFakePluginRegistry()
	proc := fakes.NewFakeProcessManager()

	terminate, err := pipeline.ProvideTerminationStage(cfg, reg, proc)
	require.NoError(t, err)
	errTracker := pluginerrs.ProvideErrorTracker()

	angularInspector := opts.angularInspector
	if opts.angularInspector == nil {
		angularInspector = angularinspector.NewStaticInspector()
	}

	authServiceRegistry := opts.authServiceRegistry
	if authServiceRegistry == nil {
		authServiceRegistry = &fakes.FakeAuthService{}
	}

	backendFactoryProvider := opts.backendFactoryProvider
	if backendFactoryProvider == nil {
		backendFactoryProvider = fakes.NewFakeBackendProcessProvider()
	}

	return ProvideService(cfg, pipeline.ProvideDiscoveryStage(cfg,
		finder.NewLocalFinder(false), reg),
		pipeline.ProvideBootstrapStage(cfg, signature.DefaultCalculator(cfg), assets),
		pipeline.ProvideValidationStage(cfg, signature.NewValidator(signature.NewUnsignedAuthorizer(cfg)), angularInspector),
		pipeline.ProvideInitializationStage(cfg, reg, backendFactoryProvider, proc, authServiceRegistry, fakes.NewFakeRoleRegistry(), fakes.NewFakeActionSetRegistry(), fakes.NewFakePluginEnvProvider(), tracing.InitializeTracerForTest()),
		terminate, errTracker)
}

func verifyState(t *testing.T, ps []*plugins.Plugin, reg registry.Service,
	procPrvdr *fakes.FakeBackendProcessProvider, procMngr *fakes.FakeProcessManager,
) {
	t.Helper()

	for _, p := range ps {
		regP, exists := reg.Plugin(context.Background(), p.ID, p.Info.Version)
		require.True(t, exists)
		if !cmp.Equal(p, regP, compareOpts...) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(p, regP, compareOpts...))
		}

		if p.Backend {
			require.Equal(t, 1, procPrvdr.Requested[p.ID])
			require.Equal(t, 1, procPrvdr.Invoked[p.ID])
		} else {
			require.Zero(t, procPrvdr.Requested[p.ID])
			require.Zero(t, procPrvdr.Invoked[p.ID])
		}

		require.Equal(t, 1, procMngr.Started[p.ID])
		require.Zero(t, procMngr.Stopped[p.ID])
	}
}

func mustNewStaticFSForTests(t *testing.T, dir string) plugins.FS {
	sfs, err := plugins.NewStaticFS(plugins.NewLocalFS(dir))
	require.NoError(t, err)
	return sfs
}

func testDataDir(t *testing.T) string {
	dir, err := filepath.Abs("../../../plugins/manager/testdata")
	if err != nil {
		t.Errorf("could not construct absolute path of current dir")
		return ""
	}
	return dir
}

func corePluginDir(t *testing.T) string {
	dir, err := filepath.Abs("./../../../../public")
	if err != nil {
		t.Errorf("could not construct absolute path of core plugins dir")
		return ""
	}
	return dir
}
