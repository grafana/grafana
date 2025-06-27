package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV37(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "legend normalization with nested panels",
			input: map[string]interface{}{
				"title":         "V37 Legend Normalization Test Dashboard",
				"schemaVersion": 36,
				"panels": []interface{}{
					// Boolean legend true
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with Boolean Legend True",
						"id":    1,
						"options": map[string]interface{}{
							"legend": true,
						},
					},
					// Boolean legend false
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with Boolean Legend False",
						"id":    2,
						"options": map[string]interface{}{
							"legend": false,
						},
					},
					// Hidden displayMode (deprecated)
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel with Hidden DisplayMode",
						"id":    3,
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "hidden",
								"showLegend":  true, // conflicting with hidden
							},
						},
					},
					// ShowLegend false with other displayMode
					map[string]interface{}{
						"type":  "stat",
						"title": "Panel with ShowLegend False",
						"id":    4,
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "table",
								"showLegend":  false,
							},
						},
					},
					// Valid legend with table displayMode
					map[string]interface{}{
						"type":  "barchart",
						"title": "Panel with Table Legend",
						"id":    5,
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "table",
								"placement":   "bottom",
							},
						},
					},
					// Valid legend with list displayMode
					map[string]interface{}{
						"type":  "histogram",
						"title": "Panel with List Legend",
						"id":    6,
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "list",
								"placement":   "right",
							},
						},
					},
					// Panel with no options
					map[string]interface{}{
						"type":  "text",
						"title": "Panel with No Options",
						"id":    7,
					},
					// Panel with no legend config
					map[string]interface{}{
						"type":  "gauge",
						"title": "Panel with No Legend Config",
						"id":    8,
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"fields": "/.*temperature.*/",
							},
						},
					},
					// Panel with null legend
					map[string]interface{}{
						"type":  "piechart",
						"title": "Panel with Null Legend",
						"id":    9,
						"options": map[string]interface{}{
							"legend": nil,
						},
					},
					// Row with nested panels
					map[string]interface{}{
						"type":      "row",
						"title":     "Row with Nested Panels Having Various Legend Configs",
						"id":        10,
						"collapsed": false,
						"panels": []interface{}{
							// Nested panel with boolean legend
							map[string]interface{}{
								"type":  "timeseries",
								"title": "Nested Panel with Boolean Legend",
								"id":    11,
								"options": map[string]interface{}{
									"legend": true,
								},
							},
							// Nested panel with hidden displayMode
							map[string]interface{}{
								"type":  "graph",
								"title": "Nested Panel with Hidden DisplayMode",
								"id":    12,
								"options": map[string]interface{}{
									"legend": map[string]interface{}{
										"displayMode": "hidden",
									},
								},
							},
							// Nested panel with conflicting properties
							map[string]interface{}{
								"type":  "stat",
								"title": "Nested Panel with Conflicting Properties",
								"id":    13,
								"options": map[string]interface{}{
									"legend": map[string]interface{}{
										"displayMode": "table",
										"showLegend":  false, // conflict: table mode but showLegend false
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V37 Legend Normalization Test Dashboard",
				"schemaVersion": 37,
				"panels": []interface{}{
					// Boolean legend true (migrated)
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with Boolean Legend True",
						"id":    1,
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "list",
								"showLegend":  true,
							},
						},
					},
					// Boolean legend false (migrated)
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel with Boolean Legend False",
						"id":    2,
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "list",
								"showLegend":  false,
							},
						},
					},
					// Hidden displayMode (normalized)
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel with Hidden DisplayMode",
						"id":    3,
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "list",
								"showLegend":  false,
							},
						},
					},
					// ShowLegend false (normalized)
					map[string]interface{}{
						"type":  "stat",
						"title": "Panel with ShowLegend False",
						"id":    4,
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "list",
								"showLegend":  false,
							},
						},
					},
					// Valid legend with table displayMode (showLegend added)
					map[string]interface{}{
						"type":  "barchart",
						"title": "Panel with Table Legend",
						"id":    5,
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "table",
								"placement":   "bottom",
								"showLegend":  true,
							},
						},
					},
					// Valid legend with list displayMode (showLegend added)
					map[string]interface{}{
						"type":  "histogram",
						"title": "Panel with List Legend",
						"id":    6,
						"options": map[string]interface{}{
							"legend": map[string]interface{}{
								"displayMode": "list",
								"placement":   "right",
								"showLegend":  true,
							},
						},
					},
					// Panel with no options (unchanged)
					map[string]interface{}{
						"type":  "text",
						"title": "Panel with No Options",
						"id":    7,
					},
					// Panel with no legend config (unchanged)
					map[string]interface{}{
						"type":  "gauge",
						"title": "Panel with No Legend Config",
						"id":    8,
						"options": map[string]interface{}{
							"reduceOptions": map[string]interface{}{
								"fields": "/.*temperature.*/",
							},
						},
					},
					// Panel with null legend (unchanged)
					map[string]interface{}{
						"type":  "piechart",
						"title": "Panel with Null Legend",
						"id":    9,
						"options": map[string]interface{}{
							"legend": nil,
						},
					},
					// Row with nested panels (nested panels migrated)
					map[string]interface{}{
						"type":      "row",
						"title":     "Row with Nested Panels Having Various Legend Configs",
						"id":        10,
						"collapsed": false,
						"panels": []interface{}{
							// Nested panel with boolean legend (migrated)
							map[string]interface{}{
								"type":  "timeseries",
								"title": "Nested Panel with Boolean Legend",
								"id":    11,
								"options": map[string]interface{}{
									"legend": map[string]interface{}{
										"displayMode": "list",
										"showLegend":  true,
									},
								},
							},
							// Nested panel with hidden displayMode (normalized)
							map[string]interface{}{
								"type":  "graph",
								"title": "Nested Panel with Hidden DisplayMode",
								"id":    12,
								"options": map[string]interface{}{
									"legend": map[string]interface{}{
										"displayMode": "list",
										"showLegend":  false,
									},
								},
							},
							// Nested panel with conflicting properties (normalized)
							map[string]interface{}{
								"type":  "stat",
								"title": "Nested Panel with Conflicting Properties",
								"id":    13,
								"options": map[string]interface{}{
									"legend": map[string]interface{}{
										"displayMode": "list",
										"showLegend":  false,
									},
								},
							},
						},
					},
				},
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V37)
}
