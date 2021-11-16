package loader

import (
	"errors"
	"path/filepath"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/plugins"
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
		cfg             *setting.Cfg
		pluginPaths     []string
		existingPlugins map[string]struct{}
		want            []*plugins.Plugin
		pluginErrors    map[string]*plugins.Error
	}{
		{
			name: "Load a Core plugin",
			cfg: &setting.Cfg{
				StaticRootPath: corePluginDir,
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
						QueryOptions: map[string]bool{"minInterval": true},
					},
					Module:    "app/plugins/datasource/cloudwatch/module",
					BaseURL:   "public/app/plugins/datasource/cloudwatch",
					PluginDir: filepath.Join(corePluginDir, "app/plugins/datasource/cloudwatch"),
					Signature: "internal",
					Class:     "core",
				},
			},
		},
		{
			name: "Load a Bundled plugin",
			cfg: &setting.Cfg{
				BundledPluginsPath: filepath.Join(parentDir, "testdata"),
			},
			pluginPaths: []string{"../testdata/valid-v2-signature"},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "test",
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
					Module:        "plugins/test/module",
					BaseURL:       "public/plugins/test",
					PluginDir:     filepath.Join(parentDir, "testdata/valid-v2-signature/plugin/"),
					Signature:     "valid",
					SignatureType: plugins.GrafanaSignature,
					SignatureOrg:  "Grafana Labs",
					Class:         "bundled",
				},
			},
		}, {
			name: "Load an External plugin",
			cfg: &setting.Cfg{
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
			name: "Load an unsigned plugin (development)",
			cfg: &setting.Cfg{
				PluginsPath: filepath.Join(parentDir),
				Env:         "development",
			},
			pluginPaths: []string{"../testdata/unsigned-datasource"},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "test",
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
					Module:    "plugins/test/module",
					BaseURL:   "public/plugins/test",
					PluginDir: filepath.Join(parentDir, "testdata/unsigned-datasource/plugin"),
					Signature: "unsigned",
				},
			},
		}, {
			name: "Load an unsigned plugin (production)",
			cfg: &setting.Cfg{
				PluginsPath: filepath.Join(parentDir),
				Env:         "production",
			},
			pluginPaths: []string{"../testdata/unsigned-datasource"},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test": {
					PluginID:  "test",
					ErrorCode: "signatureMissing",
				},
			},
		},
		{
			name: "Load an unsigned plugin using PluginsAllowUnsigned config (production)",
			cfg: &setting.Cfg{
				PluginsPath:          filepath.Join(parentDir),
				Env:                  "production",
				PluginsAllowUnsigned: []string{"test"},
			},
			pluginPaths: []string{"../testdata/unsigned-datasource"},
			want: []*plugins.Plugin{
				{
					JSONData: plugins.JSONData{
						ID:   "test",
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
					Module:    "plugins/test/module",
					BaseURL:   "public/plugins/test",
					PluginDir: filepath.Join(parentDir, "testdata/unsigned-datasource/plugin"),
					Signature: "unsigned",
				},
			},
		},
		{
			name: "Load an unsigned plugin with modified signature (production)",
			cfg: &setting.Cfg{
				PluginsPath: filepath.Join(parentDir),
				Env:         "production",
			},
			pluginPaths: []string{"../testdata/lacking-files"},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test": {
					PluginID:  "test",
					ErrorCode: "signatureModified",
				},
			},
		},
		{
			name: "Load an unsigned plugin with modified signature using PluginsAllowUnsigned config (production) still includes a signing error",
			cfg: &setting.Cfg{
				PluginsPath:          filepath.Join(parentDir),
				Env:                  "production",
				PluginsAllowUnsigned: []string{"test"},
			},
			pluginPaths: []string{"../testdata/lacking-files"},
			want:        []*plugins.Plugin{},
			pluginErrors: map[string]*plugins.Error{
				"test": {
					PluginID:  "test",
					ErrorCode: "signatureModified",
				},
			},
		},
	}
	for _, tt := range tests {
		l := newLoader(tt.cfg)
		t.Run(tt.name, func(t *testing.T) {
			got, err := l.Load(tt.pluginPaths, tt.existingPlugins)
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

func TestLoader_Load_MultiplePlugins(t *testing.T) {
	parentDir, err := filepath.Abs("../")
	if err != nil {
		t.Errorf("could not construct absolute path of current dir")
		return
	}

	t.Run("Load multiple", func(t *testing.T) {
		tests := []struct {
			name            string
			cfg             *setting.Cfg
			pluginPaths     []string
			appURL          string
			existingPlugins map[string]struct{}
			want            []*plugins.Plugin
			pluginErrors    map[string]*plugins.Error
		}{
			{
				name: "Load multiple plugins (broken, valid, unsigned)",
				cfg: &setting.Cfg{
					Env:         "production",
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
							ID:   "test",
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
						Module:        "plugins/test/module",
						BaseURL:       "public/plugins/test",
						PluginDir:     filepath.Join(parentDir, "testdata/valid-v2-pvt-signature/plugin"),
						Signature:     "valid",
						SignatureType: plugins.PrivateSignature,
						SignatureOrg:  "Will Browne",
					},
				},
				pluginErrors: map[string]*plugins.Error{
					"test": {
						PluginID:  "test",
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

				got, err := l.Load(tt.pluginPaths, tt.existingPlugins)
				require.NoError(t, err)
				sort.SliceStable(got, func(i, j int) bool {
					return got[i].ID < got[j].ID
				})
				if !cmp.Equal(got, tt.want, compareOpts) {
					t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, tt.want, compareOpts))
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
					ID:   "test",
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
				Class:         "external",
				Signature:     "valid",
				SignatureType: "private",
				SignatureOrg:  "Will Browne",
				Module:        "plugins/test/module",
				BaseURL:       "public/plugins/test",
			},
		}

		l := newLoader(&setting.Cfg{PluginsPath: filepath.Join(parentDir)})
		got, err := l.Load(paths, map[string]struct{}{})
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

		l := newLoader(&setting.Cfg{
			PluginsPath: filepath.Dir(pluginDir),
		})

		got, err := l.Load([]string{pluginDir, pluginDir}, map[string]struct{}{})
		assert.NoError(t, err)

		if !cmp.Equal(got, expected, compareOpts) {
			t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts))
		}
	})
}

func TestLoader_loadNestedPlugins(t *testing.T) {
	parentDir, err := filepath.Abs("../")
	if err != nil {
		t.Errorf("could not construct absolute path of root dir")
		return
	}
	parent := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID:   "test-ds",
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
		Module:        "plugins/test-ds/module",
		BaseURL:       "public/plugins/test-ds",
		PluginDir:     filepath.Join(parentDir, "testdata/nested-plugins/parent"),
		Signature:     "valid",
		SignatureType: plugins.GrafanaSignature,
		SignatureOrg:  "Grafana Labs",
		Class:         "external",
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
		PluginDir:     filepath.Join(parentDir, "testdata/nested-plugins/parent/nested"),
		Signature:     "valid",
		SignatureType: plugins.GrafanaSignature,
		SignatureOrg:  "Grafana Labs",
		Class:         "external",
	}

	parent.Children = []*plugins.Plugin{child}
	child.Parent = parent

	t.Run("Load nested External plugins", func(t *testing.T) {
		expected := []*plugins.Plugin{parent, child}
		l := newLoader(&setting.Cfg{
			PluginsPath: parentDir,
		})

		got, err := l.Load([]string{"../testdata/nested-plugins"}, map[string]struct{}{})
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

		l := newLoader(&setting.Cfg{
			PluginsPath: parentDir,
		})

		got, err := l.Load([]string{"../testdata/nested-plugins"}, map[string]struct{}{
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
					{Name: "Nginx Connections", Path: "dashboards/connections.json", Type: "dashboard"},
					{Name: "Nginx Memory", Path: "dashboards/memory.json", Type: "dashboard"},
					{Name: "Nginx Panel", Type: "panel"},
					{Name: "Nginx Datasource", Type: "datasource"},
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

func Test_pluginClass(t *testing.T) {
	type args struct {
		pluginDir string
		cfg       *setting.Cfg
	}
	tests := []struct {
		name     string
		args     args
		expected plugins.Class
	}{
		{
			name: "Core plugin class",
			args: args{
				pluginDir: "/root/app/plugins/test-app",
				cfg: &setting.Cfg{
					StaticRootPath: "/root",
				},
			},
			expected: plugins.Core,
		},
		{
			name: "Bundled plugin class",
			args: args{
				pluginDir: "/test-app",
				cfg: &setting.Cfg{
					BundledPluginsPath: "/test-app",
				},
			},
			expected: plugins.Bundled,
		},
		{
			name: "External plugin class",
			args: args{
				pluginDir: "/test-app",
				cfg: &setting.Cfg{
					PluginsPath: "/test-app",
				},
			},
			expected: plugins.External,
		},
		{
			name: "External plugin class",
			args: args{
				pluginDir: "/test-app",
				cfg: &setting.Cfg{
					PluginsPath: "/root",
				},
			},
			expected: plugins.External,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := newLoader(tt.args.cfg)
			got := l.pluginClass(tt.args.pluginDir)
			assert.Equal(t, tt.expected, got)
		})
	}
}

func newLoader(cfg *setting.Cfg) *Loader {
	return &Loader{
		cfg:                cfg,
		pluginFinder:       finder.New(cfg),
		pluginInitializer:  initializer.New(cfg, &fakeLicensingService{}),
		signatureValidator: signature.NewValidator(&signature.UnsignedPluginAuthorizer{Cfg: cfg}),
		errs:               make(map[string]*plugins.SignatureError),
	}
}

type fakeLicensingService struct {
	edition    string
	hasLicense bool
	tokenRaw   string
}

func (t *fakeLicensingService) HasLicense() bool {
	return t.hasLicense
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

func (t *fakeLicensingService) LicenseURL(showAdminLicensingPage bool) string {
	return ""
}

func (t *fakeLicensingService) HasValidLicense() bool {
	return false
}

func (t *fakeLicensingService) Environment() map[string]string {
	return map[string]string{"GF_ENTERPRISE_LICENSE_TEXT": t.tokenRaw}
}
