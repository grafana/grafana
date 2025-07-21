package schemaversion

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestV28(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "migrate angular singlestat to stat panel",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":         1,
						"type":       "singlestat",
						"valueName":  "avg",
						"format":     "ms",
						"decimals":   2,
						"thresholds": "10,20,30",
						"colors":     []interface{}{"green", "yellow", "red"},
						"gauge": map[string]interface{}{
							"show": false,
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "var1",
							"tags":           []interface{}{"tag1"},
							"tagsQuery":      "query",
							"tagValuesQuery": "values",
							"useTags":        true,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":              1,
						"type":            "stat",
						"autoMigrateFrom": "singlestat",
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"calcs": []string{"mean"},
							},
							"orientation": "horizontal",
							"colorMode":   "none",
							"graphMode":   "none",
						},
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit":     "ms",
								"decimals": 2,
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{
											"color": "green",
											"value": nil,
										},
										map[string]interface{}{
											"color": "yellow",
											"value": 10.0,
										},
										map[string]interface{}{
											"color": "red",
											"value": 20.0,
										},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "var1",
						},
					},
				},
			},
		},
		{
			name: "migrate angular singlestat to gauge panel",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"type":      "singlestat",
						"valueName": "current",
						"format":    "percent",
						"gauge": map[string]interface{}{
							"show":             true,
							"thresholdMarkers": true,
							"thresholdLabels":  false,
						},
						"sparkline": map[string]interface{}{
							"show":      true,
							"lineColor": "#ff0000",
						},
						"colorBackground": true,
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":              1,
						"type":            "gauge",
						"autoMigrateFrom": "singlestat",
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"calcs": []string{"lastNotNull"},
							},
							"orientation":          "horizontal",
							"colorMode":            "background",
							"graphMode":            "area",
							"showThresholdMarkers": true,
							"showThresholdLabels":  false,
						},
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit": "percent",
								"min":  0,
								"max":  100,
								"color": map[string]interface{}{
									"mode":       "fixed",
									"fixedColor": "#ff0000",
								},
							},
							"overrides": []interface{}{},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
		},
		{
			name: "migrate grafana-singlestat-panel to stat panel",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "grafana-singlestat-panel",
						"options": map[string]interface{}{
							"valueOptions": map[string]interface{}{
								"unit":     "short",
								"decimals": 1,
								"stat":     "max",
							},
							"thresholds": []interface{}{
								map[string]interface{}{
									"color": "green",
									"value": nil,
								},
								map[string]interface{}{
									"color": "red",
									"value": 80.0,
								},
							},
							"minValue": 0,
							"maxValue": 100,
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":              1,
						"type":            "stat",
						"autoMigrateFrom": "grafana-singlestat-panel",
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"calcs": []string{"max"},
							},
							"orientation": "horizontal",
						},
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"unit":     "short",
								"decimals": 1,
								"min":      0,
								"max":      100,
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{
											"color": "green",
											"value": nil,
										},
										map[string]interface{}{
											"color": "red",
											"value": 80.0,
										},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
		},
		{
			name: "handle nested panels in rows",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"id":        2,
								"type":      "singlestat",
								"valueName": "sum",
								"format":    "bytes",
								"targets": []interface{}{
									map[string]interface{}{"refId": "A"},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"id":              2,
								"type":            "stat",
								"autoMigrateFrom": "singlestat",
								"options": map[string]interface{}{
									"reduceOptions": map[string]interface{}{
										"calcs": []string{"sum"},
									},
									"orientation": "horizontal",
									"colorMode":   "none",
									"graphMode":   "none",
								},
								"fieldConfig": map[string]interface{}{
									"defaults": map[string]interface{}{
										"unit": "bytes",
									},
									"overrides": []interface{}{},
								},
								"targets": []interface{}{
									map[string]interface{}{"refId": "A"},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "remove deprecated variable properties",
			input: map[string]interface{}{
				"schemaVersion": 27,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "var1",
							"type":           "query",
							"tags":           []interface{}{"tag1", "tag2"},
							"tagsQuery":      "SELECT * FROM tags",
							"tagValuesQuery": "SELECT value FROM tag_values",
							"useTags":        true,
						},
						map[string]interface{}{
							"name": "var2",
							"type": "custom",
							// No deprecated properties
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 28,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "var1",
							"type": "query",
						},
						map[string]interface{}{
							"name": "var2",
							"type": "custom",
						},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock panel provider that includes grafana-singlestat-panel for the specific test
			var panelProvider PanelPluginInfoProvider
			if tt.name == "keep grafana-singlestat-panel if plugin exists" {
				panelProvider = &mockPanelProvider{
					panels: []PanelPluginInfo{
						{ID: "grafana-singlestat-panel"},
					},
				}
			} else {
				panelProvider = &mockPanelProvider{
					panels: []PanelPluginInfo{},
				}
			}

			migration := V28(panelProvider)
			err := migration(tt.input)
			require.NoError(t, err)

			assert.Equal(t, tt.expected, tt.input)
		})
	}
}

// Test what our migration actually produces
func TestV28ActualOutput(t *testing.T) {
	input := map[string]interface{}{
		"schemaVersion": 27,
		"panels": []interface{}{
			map[string]interface{}{
				"type":       "singlestat",
				"legend":     true,
				"thresholds": "10,20,30",
				"colors":     []interface{}{"#FF0000", "green", "orange"},
				"aliasYAxis": map[string]interface{}{"test": 2},
				"grid":       map[string]interface{}{"min": 1, "max": 10},
				"targets":    []interface{}{map[string]interface{}{"refId": "A"}},
			},
		},
	}

	panelProvider := &mockPanelProvider{panels: []PanelPluginInfo{}}
	migration := V28(panelProvider)
	err := migration(input)
	require.NoError(t, err)

	// Print the actual output
	outBytes, err := json.MarshalIndent(input, "", "  ")
	require.NoError(t, err)
	fmt.Printf("Actual output:\n%s\n", string(outBytes))
}

type mockPanelProvider struct {
	panels []PanelPluginInfo
}

func (m *mockPanelProvider) GetPanels() []PanelPluginInfo {
	return m.panels
}
