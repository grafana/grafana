package plugins

import (
	"errors"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/stretchr/testify/require"
)

func Test_ReadPluginJSON(t *testing.T) {
	tests := []struct {
		name       string
		pluginJSON func(t *testing.T) io.ReadCloser
		expected   JSONData
		err        error
	}{
		{
			name: "Valid plugin",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				reader, err := os.Open("manager/testdata/test-app/plugin.json")
				require.NoError(t, err)
				return reader
			},
			expected: JSONData{
				ID:   "test-app",
				Type: TypeApp,
				Name: "Test App",
				Info: Info{
					Author: InfoLink{
						Name: "Test Inc.",
						URL:  "http://test.com",
					},
					Description: "Official Grafana Test App & Dashboard bundle",
					Version:     "1.0.0",
					Links: []InfoLink{
						{Name: "Project site", URL: "http://project.com"},
						{Name: "License & Terms", URL: "http://license.com"},
					},
					Logos: Logos{
						Small: "img/logo_small.png",
						Large: "img/logo_large.png",
					},
					Screenshots: []Screenshots{
						{Path: "img/screenshot1.png", Name: "img1"},
						{Path: "img/screenshot2.png", Name: "img2"},
					},
					Updated:  "2015-02-10",
					Keywords: []string{"test"},
				},
				Dependencies: Dependencies{
					GrafanaVersion: "3.x.x",
					Plugins: []Dependency{
						{Type: "datasource", ID: "graphite", Name: "Graphite", Version: "1.0.0"},
						{Type: "panel", ID: "graph", Name: "Graph", Version: "1.0.0"},
					},
				},
				Includes: []*Includes{
					{Name: "Nginx Connections", Path: "dashboards/connections.json", Type: "dashboard", Role: org.RoleViewer, Action: ActionAppAccess},
					{Name: "Nginx Memory", Path: "dashboards/memory.json", Type: "dashboard", Role: org.RoleViewer, Action: ActionAppAccess},
					{Name: "Nginx Panel", Type: "panel", Role: org.RoleViewer, Action: ActionAppAccess},
					{Name: "Nginx Datasource", Type: "datasource", Role: org.RoleViewer, Action: ActionAppAccess},
				},
				Backend: false,
			},
		},
		{
			name: "Invalid plugin JSON",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				reader, err := os.Open("manager/testdata/invalid-plugin-json/plugin.json")
				require.NoError(t, err)
				return reader
			},
			err: ErrInvalidPluginJSON,
		},
		{
			name: "Default value overrides",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				pJSON := `{
					"id": "grafana-piechart-panel",
					"name": "This will be overwritten",
					"type": "panel",
					"includes": [
						{"type": "dashboard", "name": "Pie Charts", "path": "dashboards/demo.json"}
					]
				}`
				return io.NopCloser(strings.NewReader(pJSON))
			},
			expected: JSONData{
				ID:   "grafana-piechart-panel",
				Type: TypePanel,
				Name: "Pie Chart (old)",
				Dependencies: Dependencies{
					GrafanaVersion: "*",
					Plugins:        []Dependency{},
				},
				Includes: []*Includes{
					{Name: "Pie Charts", Path: "dashboards/demo.json", Type: "dashboard", Role: org.RoleViewer},
				},
			},
		},
		{
			name: "Phlare<>Pyroscope rebranding -- hardcoded alias",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				pJSON := `{
					"id": "grafana-pyroscope-datasource",
					"type": "datasource",
					"aliasIDs": ["phlare"]
				}`
				return io.NopCloser(strings.NewReader(pJSON))
			},
			expected: JSONData{
				ID:       "grafana-pyroscope-datasource",
				AliasIDs: []string{"phlare"}, // Hardcoded from the parser
				Type:     TypeDataSource,
				Dependencies: Dependencies{
					GrafanaDependency: "",
					GrafanaVersion:    "*",
					Plugins:           []Dependency{},
				},
			},
		},
		{
			name: "do not allow alias except for our hardcoded set",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				pJSON := `{
					"id": "my-custom-app",
					"type": "app",
					"aliasIDs": ["phlare"]
				}`
				return io.NopCloser(strings.NewReader(pJSON))
			},
			err: ErrUnsupportedAlias,
			expected: JSONData{
				ID:           "my-custom-app",
				AliasIDs:     []string{"phlare"}, // Hardcoded from the parser
				Type:         "app",
				Dependencies: Dependencies{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := tt.pluginJSON(t)
			got, err := ReadPluginJSON(p)
			if tt.err != nil {
				require.ErrorIs(t, err, tt.err)
			}
			if !cmp.Equal(got, tt.expected) {
				t.Errorf("Unexpected pluginJSONData: %v", cmp.Diff(got, tt.expected))
			}
			require.NoError(t, p.Close())
		})
	}
}

func Test_validatePluginJSON(t *testing.T) {
	type args struct {
		data JSONData
	}
	tests := []struct {
		name string
		args args
		err  error
	}{
		{
			name: "Valid case",
			args: args{
				data: JSONData{
					ID:   "grafana-plugin-id",
					Type: TypeDataSource,
				},
			},
		},
		{
			name: "Invalid plugin ID",
			args: args{
				data: JSONData{
					Type: TypePanel,
				},
			},
			err: ErrInvalidPluginJSON,
		},
		{
			name: "Invalid plugin type",
			args: args{
				data: JSONData{
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
