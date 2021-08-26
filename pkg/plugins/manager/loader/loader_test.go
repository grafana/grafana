package loader

import (
	"errors"
	"path/filepath"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp/cmpopts"

	"github.com/stretchr/testify/assert"

	"github.com/google/go-cmp/cmp"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

var compareOpts = cmpopts.IgnoreFields(plugins.PluginV2{}, "client", "log")

func TestLoader_LoadAll(t *testing.T) {
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
		log             log.Logger
		pluginPath      string
		existingPlugins map[string]struct{}
		want            []*plugins.PluginV2
		wantErr         bool
	}{
		{
			name: "Load a Core plugin",
			cfg: &setting.Cfg{
				StaticRootPath: corePluginDir,
			},
			pluginPath: filepath.Join(corePluginDir, "app/plugins/datasource/cloudwatch"),
			want: []*plugins.PluginV2{
				{
					JSONData: plugins.JSONData{
						ID:   "cloudwatch",
						Type: "datasource",
						Name: "CloudWatch",
						Info: plugins.PluginInfo{
							Author: plugins.PluginInfoLink{
								Name: "Grafana Labs",
								Url:  "https://grafana.com",
							},
							Description: "Data source for Amazon AWS monitoring service",
							Logos: plugins.PluginLogos{
								Small: "public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png",
								Large: "public/app/plugins/datasource/cloudwatch/img/amazon-web-services.png",
							},
						},
						Includes: []*plugins.PluginInclude{
							{Name: "EC2", Path: "dashboards/ec2.json", Type: "dashboard", Role: "Viewer"},
							{Name: "EBS", Path: "dashboards/EBS.json", Type: "dashboard", Role: "Viewer"},
							{Name: "Lambda", Path: "dashboards/Lambda.json", Type: "dashboard", Role: "Viewer"},
							{Name: "Logs", Path: "dashboards/Logs.json", Type: "dashboard", Role: "Viewer"},
							{Name: "RDS", Path: "dashboards/RDS.json", Type: "dashboard", Role: "Viewer"},
						},
						Dependencies: plugins.PluginDependencies{
							GrafanaVersion: "*",
							Plugins:        []plugins.PluginDependencyItem{},
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
			wantErr: false,
		}, {
			name: "Load a Bundled plugin",
			cfg: &setting.Cfg{
				BundledPluginsPath: filepath.Join(parentDir, "testdata"),
			},
			pluginPath: "../testdata/unsigned-datasource",
			want: []*plugins.PluginV2{
				{
					JSONData: plugins.JSONData{
						ID:   "test",
						Type: "datasource",
						Name: "Test",
						Info: plugins.PluginInfo{
							Author: plugins.PluginInfoLink{
								Name: "Grafana Labs",
								Url:  "https://grafana.com",
							},
							Logos: plugins.PluginLogos{
								Small: "public/img/icn-datasource.svg",
								Large: "public/img/icn-datasource.svg",
							},
							Description: "Test",
						},
						Dependencies: plugins.PluginDependencies{
							GrafanaVersion: "*",
							Plugins:        []plugins.PluginDependencyItem{},
						},
						Backend: true,
						State:   "alpha",
					},
					Module:    "app/plugins/datasource/plugin/module",
					BaseURL:   "public/app/plugins/datasource/plugin",
					PluginDir: filepath.Join(parentDir, "testdata/unsigned-datasource/plugin/"),
					Signature: "unsigned",
					Class:     "bundled",
				},
			},
			wantErr: false,
		}, {
			name: "Load an External plugin",
			cfg: &setting.Cfg{
				PluginsPath: filepath.Join(parentDir),
			},
			pluginPath: "../testdata/symbolic-plugin-dirs",
			want: []*plugins.PluginV2{
				{
					JSONData: plugins.JSONData{
						ID:   "test-app",
						Type: "app",
						Name: "Test App",
						Info: plugins.PluginInfo{
							Author: plugins.PluginInfoLink{
								Name: "Test Inc.",
								Url:  "http://test.com",
							},
							Logos: plugins.PluginLogos{
								Small: "public/plugins/test-app/img/logo_small.png",
								Large: "public/plugins/test-app/img/logo_large.png",
							},
							Links: []plugins.PluginInfoLink{
								{Name: "Project site", Url: "http://project.com"},
								{Name: "License & Terms", Url: "http://license.com"},
							},
							Description: "Official Grafana Test App & Dashboard bundle",
							Screenshots: []plugins.PluginScreenshots{
								{Path: "public/plugins/test-app/img/screenshot1.png", Name: "img1"},
								{Path: "public/plugins/test-app/img/screenshot2.png", Name: "img2"},
							},
							Version: "1.0.0",
							Updated: "2015-02-10",
						},
						Dependencies: plugins.PluginDependencies{
							GrafanaVersion: "3.x.x",
							Plugins: []plugins.PluginDependencyItem{
								{Type: "datasource", Id: "graphite", Name: "Graphite", Version: "1.0.0"},
								{Type: "panel", Id: "graph", Name: "Graph", Version: "1.0.0"},
							},
						},
						Includes: []*plugins.PluginInclude{
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
					SignatureType: plugins.GrafanaType,
					SignatureOrg:  "Grafana Labs",
				},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := New(nil, nil, tt.cfg)
			got, err := l.LoadAll(tt.pluginPath, tt.existingPlugins)
			if (err != nil) != tt.wantErr {
				t.Errorf("LoadAll() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !cmp.Equal(got, tt.want, compareOpts) {
				t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, tt.want, compareOpts))
			}
		})
	}
}

func TestLoader_loadNestedPlugins(t *testing.T) {
	parentDir, err := filepath.Abs("../")
	if err != nil {
		t.Errorf("could not construct absolute path of root dir")
		return
	}
	parent := &plugins.PluginV2{
		JSONData: plugins.JSONData{
			ID:   "test-ds",
			Type: "datasource",
			Name: "Parent",
			Info: plugins.PluginInfo{
				Author: plugins.PluginInfoLink{
					Name: "Grafana Labs",
					Url:  "http://grafana.com",
				},
				Logos: plugins.PluginLogos{
					Small: "public/img/icn-datasource.svg",
					Large: "public/img/icn-datasource.svg",
				},
				Description: "Parent plugin",
				Version:     "1.0.0",
				Updated:     "2020-10-20",
			},
			Dependencies: plugins.PluginDependencies{
				GrafanaVersion: "*",
				Plugins:        []plugins.PluginDependencyItem{},
			},
			Backend: true,
		},
		Module:        "plugins/test-ds/module",
		BaseURL:       "public/plugins/test-ds",
		PluginDir:     filepath.Join(parentDir, "testdata/nested-plugins/parent"),
		Signature:     "valid",
		SignatureType: plugins.GrafanaType,
		SignatureOrg:  "Grafana Labs",
		Class:         "external",
	}

	child := &plugins.PluginV2{
		JSONData: plugins.JSONData{
			ID:   "test-panel",
			Type: "panel",
			Name: "Child",
			Info: plugins.PluginInfo{
				Author: plugins.PluginInfoLink{
					Name: "Grafana Labs",
					Url:  "http://grafana.com",
				},
				Logos: plugins.PluginLogos{
					Small: "public/img/icn-panel.svg",
					Large: "public/img/icn-panel.svg",
				},
				Description: "Child plugin",
				Version:     "1.0.1",
				Updated:     "2020-10-30",
			},
			Dependencies: plugins.PluginDependencies{
				GrafanaVersion: "*",
				Plugins:        []plugins.PluginDependencyItem{},
			},
		},
		Module:        "plugins/test-panel/module",
		BaseURL:       "public/plugins/test-panel",
		PluginDir:     filepath.Join(parentDir, "testdata/nested-plugins/parent/nested"),
		Signature:     "valid",
		SignatureType: plugins.GrafanaType,
		SignatureOrg:  "Grafana Labs",
		Class:         "external",
	}

	parent.Children = []*plugins.PluginV2{child}
	child.Parent = parent

	t.Run("Load nested External plugins", func(t *testing.T) {
		expected := []*plugins.PluginV2{parent, child}
		cfg := &setting.Cfg{
			PluginsPath: parentDir,
		}

		l := New(nil, nil, cfg)

		got, err := l.LoadAll("../testdata/nested-plugins", map[string]struct{}{})
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
		expected := []*plugins.PluginV2{parent}

		cfg := &setting.Cfg{
			PluginsPath: parentDir,
		}

		l := New(nil, nil, cfg)

		got, err := l.LoadAll("../testdata/nested-plugins", map[string]struct{}{
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
				Info: plugins.PluginInfo{
					Author: plugins.PluginInfoLink{
						Name: "Test Inc.",
						Url:  "http://test.com",
					},
					Description: "Official Grafana Test App & Dashboard bundle",
					Version:     "1.0.0",
					Links: []plugins.PluginInfoLink{
						{Name: "Project site", Url: "http://project.com"},
						{Name: "License & Terms", Url: "http://license.com"},
					},
					Logos: plugins.PluginLogos{
						Small: "img/logo_small.png",
						Large: "img/logo_large.png",
					},
					Screenshots: []plugins.PluginScreenshots{
						{Path: "img/screenshot1.png", Name: "img1"},
						{Path: "img/screenshot2.png", Name: "img2"},
					},
					Updated: "2015-02-10",
				},
				Dependencies: plugins.PluginDependencies{
					GrafanaVersion: "3.x.x",
					Plugins: []plugins.PluginDependencyItem{
						{Type: "datasource", Id: "graphite", Name: "Graphite", Version: "1.0.0"},
						{Type: "panel", Id: "graph", Name: "Graph", Version: "1.0.0"},
					},
				},
				Includes: []*plugins.PluginInclude{
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
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := New(nil, nil, nil)
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
			err: InvalidPluginJSON,
		},
		{
			name: "Invalid plugin type",
			args: args{
				data: plugins.JSONData{
					ID:   "grafana-plugin-id",
					Type: "test",
				},
			},
			err: InvalidPluginJSON,
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
