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

				Extensions: Extensions{
					AddedLinks:        []AddedLink{},
					AddedComponents:   []AddedComponent{},
					AddedFunctions:    []AddedFunction{},
					ExposedComponents: []ExposedComponent{},
					ExtensionPoints:   []ExtensionPoint{},
				},

				Dependencies: Dependencies{
					GrafanaVersion: "3.x.x",
					Plugins: []Dependency{
						{Type: "datasource", ID: "graphite", Name: "Graphite"},
						{Type: "panel", ID: "graph", Name: "Graph"},
					},
					Extensions: ExtensionsDependencies{
						ExposedComponents: []string{},
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

				Extensions: Extensions{
					AddedLinks:      []AddedLink{},
					AddedComponents: []AddedComponent{},
					AddedFunctions:  []AddedFunction{},

					ExposedComponents: []ExposedComponent{},
					ExtensionPoints:   []ExtensionPoint{},
				},

				Dependencies: Dependencies{
					GrafanaVersion: "*",
					Plugins:        []Dependency{},
					Extensions: ExtensionsDependencies{
						ExposedComponents: []string{},
					},
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

				Extensions: Extensions{
					AddedLinks:      []AddedLink{},
					AddedComponents: []AddedComponent{},
					AddedFunctions:  []AddedFunction{},

					ExposedComponents: []ExposedComponent{},
					ExtensionPoints:   []ExtensionPoint{},
				},

				Dependencies: Dependencies{
					GrafanaDependency: "",
					GrafanaVersion:    "*",
					Plugins:           []Dependency{},
					Extensions: ExtensionsDependencies{
						ExposedComponents: []string{},
					},
				},
			},
		},
		{
			name: "can read the latest versions of extensions information (v2)",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				pJSON := `{
					"id": "myorg-extensions-app",
					"name": "Extensions App",
					"type": "app",
					"extensions": {
						"addedLinks": [
							{
								"title": "Added link 1",
								"description": "Added link 1 description",
								"targets": ["grafana/dashboard/panel/menu"]
							}
						],
						"addedComponents": [
							{
								"title": "Added component 1",
								"description": "Added component 1 description",
								"targets": ["grafana/user/profile/tab"]
							}
						],
						"exposedComponents": [
							{
								"title": "Exposed component 1",
								"description": "Exposed component 1 description",
								"id": "myorg-extensions-app/component-1/v1"
							}
						],
						"addedFunctions": [
              {"targets": ["foo/bar"], "title":"some hook"}
            ],
						"extensionPoints": [
							{
								"title": "Extension point 1",
								"description": "Extension points 1 description",
								"id": "myorg-extensions-app/extensions-point-1/v1"
							}
						]
					}
				}`
				return io.NopCloser(strings.NewReader(pJSON))
			},
			expected: JSONData{
				ID:   "myorg-extensions-app",
				Name: "Extensions App",
				Type: TypeApp,

				Extensions: Extensions{
					AddedLinks: []AddedLink{
						{Title: "Added link 1", Description: "Added link 1 description", Targets: []string{"grafana/dashboard/panel/menu"}},
					},
					AddedComponents: []AddedComponent{

						{Title: "Added component 1", Description: "Added component 1 description", Targets: []string{"grafana/user/profile/tab"}},
					},
					ExposedComponents: []ExposedComponent{
						{Id: "myorg-extensions-app/component-1/v1", Title: "Exposed component 1", Description: "Exposed component 1 description"},
					},
					ExtensionPoints: []ExtensionPoint{
						{Id: "myorg-extensions-app/extensions-point-1/v1", Title: "Extension point 1", Description: "Extension points 1 description"},
					},
					AddedFunctions: []AddedFunction{
						{Targets: []string{"foo/bar"}, Title: "some hook"},
					},
				},

				Dependencies: Dependencies{
					GrafanaVersion: "*",
					Plugins:        []Dependency{},
					Extensions: ExtensionsDependencies{
						ExposedComponents: []string{},
					},
				},
			},
		},
		{
			name: "can read deprecated extensions info (v1) and parse it as v2",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				pJSON := `{
					"id": "myorg-extensions-app",
					"name": "Extensions App",
					"type": "app",
					"extensions": [
						{
							"extensionPointId": "grafana/dashboard/panel/menu",
							"title": "Added link 1",
							"description": "Added link 1 description",
							"type": "link"
						},
						{
							"extensionPointId": "grafana/dashboard/panel/menu",
							"title": "Added link 2",
							"description": "Added link 2 description",
							"type": "link"
						},
						{
							"extensionPointId": "grafana/user/profile/tab",
							"title": "Added component 1",
							"description": "Added component 1 description",
							"type": "component"
						}
					]
				}`
				return io.NopCloser(strings.NewReader(pJSON))
			},
			expected: JSONData{
				ID:   "myorg-extensions-app",
				Name: "Extensions App",
				Type: TypeApp,

				Extensions: Extensions{
					AddedLinks: []AddedLink{
						{Title: "Added link 1", Description: "Added link 1 description", Targets: []string{"grafana/dashboard/panel/menu"}},
						{Title: "Added link 2", Description: "Added link 2 description", Targets: []string{"grafana/dashboard/panel/menu"}},
					},
					AddedComponents: []AddedComponent{
						{Title: "Added component 1", Description: "Added component 1 description", Targets: []string{"grafana/user/profile/tab"}},
					},
					AddedFunctions:    []AddedFunction{},
					ExposedComponents: []ExposedComponent{},
					ExtensionPoints:   []ExtensionPoint{},
				},

				Dependencies: Dependencies{
					GrafanaVersion: "*",
					Plugins:        []Dependency{},
					Extensions: ExtensionsDependencies{
						ExposedComponents: []string{},
					},
				},
			},
		},
		{
			name: "works if extensions info is empty",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				pJSON := `{
					"id": "myorg-extensions-app",
					"name": "Extensions App",
					"type": "app",
					"extensions": []
				}`
				return io.NopCloser(strings.NewReader(pJSON))
			},
			expected: JSONData{
				ID:   "myorg-extensions-app",
				Name: "Extensions App",
				Type: TypeApp,

				Extensions: Extensions{
					AddedLinks:      []AddedLink{},
					AddedComponents: []AddedComponent{},
					AddedFunctions:  []AddedFunction{},

					ExposedComponents: []ExposedComponent{},
					ExtensionPoints:   []ExtensionPoint{},
				},

				Dependencies: Dependencies{
					GrafanaVersion: "*",
					Plugins:        []Dependency{},
					Extensions: ExtensionsDependencies{
						ExposedComponents: []string{},
					},
				},
			},
		},
		{
			name: "works if extensions info is completely missing",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				pJSON := `{
					"id": "myorg-extensions-app",
					"name": "Extensions App",
					"type": "app"
				}`
				return io.NopCloser(strings.NewReader(pJSON))
			},
			expected: JSONData{
				ID:   "myorg-extensions-app",
				Name: "Extensions App",
				Type: TypeApp,

				Extensions: Extensions{
					AddedLinks:      []AddedLink{},
					AddedComponents: []AddedComponent{},
					AddedFunctions:  []AddedFunction{},

					ExposedComponents: []ExposedComponent{},
					ExtensionPoints:   []ExtensionPoint{},
				},

				Dependencies: Dependencies{
					GrafanaVersion: "*",
					Plugins:        []Dependency{},
					Extensions: ExtensionsDependencies{
						ExposedComponents: []string{},
					},
				},
			},
		},
		{
			name: "can read extensions related dependencies",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				pJSON := `{
					"id": "myorg-extensions-app",
					"name": "Extensions App",
					"type": "app",
					"dependencies": {
						"grafanaDependency": "10.0.0",
						"extensions": {
							"exposedComponents": ["myorg-extensions-app/component-1/v1"]
						}
					}
				}`
				return io.NopCloser(strings.NewReader(pJSON))
			},
			expected: JSONData{
				ID:   "myorg-extensions-app",
				Name: "Extensions App",
				Type: TypeApp,

				Extensions: Extensions{
					AddedLinks:        []AddedLink{},
					AddedComponents:   []AddedComponent{},
					AddedFunctions:    []AddedFunction{},
					ExposedComponents: []ExposedComponent{},
					ExtensionPoints:   []ExtensionPoint{},
				},

				Dependencies: Dependencies{
					GrafanaVersion:    "*",
					GrafanaDependency: "10.0.0",
					Plugins:           []Dependency{},
					Extensions: ExtensionsDependencies{
						ExposedComponents: []string{"myorg-extensions-app/component-1/v1"},
					},
				},
			},
		},
		{
			name: "can read languages in a datasource plugin",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				pJSON := `{
					"id": "myorg-languages-datasource",
					"name": "Languages Datasource",
					"type": "datasource",
					"languages": ["en-US", "pt-BR"]
				}`
				return io.NopCloser(strings.NewReader(pJSON))
			},
			expected: JSONData{
				ID:        "myorg-languages-datasource",
				Name:      "Languages Datasource",
				Type:      TypeDataSource,
				Languages: []string{"en-US", "pt-BR"},

				Extensions: Extensions{
					AddedLinks:        []AddedLink{},
					AddedComponents:   []AddedComponent{},
					AddedFunctions:    []AddedFunction{},
					ExposedComponents: []ExposedComponent{},
					ExtensionPoints:   []ExtensionPoint{},
				},

				Dependencies: Dependencies{
					GrafanaVersion: "*",
					Plugins:        []Dependency{},
					Extensions: ExtensionsDependencies{
						ExposedComponents: []string{},
					},
				},
			},
		},
		{
			name: "can read languages in a panel plugin",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				pJSON := `{
					"id": "myorg-languages-panel",
					"name": "Languages Panel",
					"type": "panel",
					"languages": ["en-US", "pt-BR"]
				}`
				return io.NopCloser(strings.NewReader(pJSON))
			},
			expected: JSONData{
				ID:        "myorg-languages-panel",
				Name:      "Languages Panel",
				Type:      TypePanel,
				Languages: []string{"en-US", "pt-BR"},

				Extensions: Extensions{
					AddedLinks:        []AddedLink{},
					AddedComponents:   []AddedComponent{},
					AddedFunctions:    []AddedFunction{},
					ExposedComponents: []ExposedComponent{},
					ExtensionPoints:   []ExtensionPoint{},
				},

				Dependencies: Dependencies{
					GrafanaVersion: "*",
					Plugins:        []Dependency{},
					Extensions: ExtensionsDependencies{
						ExposedComponents: []string{},
					},
				},
			},
		},
		{
			name: "can read languages in an app plugin",
			pluginJSON: func(t *testing.T) io.ReadCloser {
				pJSON := `{
					"id": "myorg-languages-app",
					"name": "Languages App",
					"type": "app",
					"languages": ["en-US", "pt-BR"]
				}`
				return io.NopCloser(strings.NewReader(pJSON))
			},
			expected: JSONData{
				ID:        "myorg-languages-app",
				Name:      "Languages App",
				Type:      TypeApp,
				Languages: []string{"en-US", "pt-BR"},

				Extensions: Extensions{
					AddedLinks:        []AddedLink{},
					AddedComponents:   []AddedComponent{},
					AddedFunctions:    []AddedFunction{},
					ExposedComponents: []ExposedComponent{},
					ExtensionPoints:   []ExtensionPoint{},
				},

				Dependencies: Dependencies{
					GrafanaVersion: "*",
					Plugins:        []Dependency{},
					Extensions: ExtensionsDependencies{
						ExposedComponents: []string{},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := tt.pluginJSON(t)
			got, err := ReadPluginJSON(p)

			// Check if the test returns the same error as expected
			// (unneccary to check further if there is an error at this point)
			if tt.err == nil && err != nil {
				t.Errorf("Error while reading pluginJSON: %+v", err)
				return
			}

			// Check if the test returns the same error as expected
			if tt.err != nil {
				require.ErrorIs(t, err, tt.err)
			}

			// Check if the test returns the expected pluginJSONData
			if !cmp.Equal(got, tt.expected) {
				t.Errorf("Unexpected pluginJSONData: %v", cmp.Diff(got, tt.expected))
			}

			// Should be able to close the reader
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
