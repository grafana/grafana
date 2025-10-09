package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV2(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "services filter migration moves time and templating list",
			input: map[string]interface{}{
				"title":         "V2 Services Filter Migration Test",
				"schemaVersion": 1,
				"services": map[string]interface{}{
					"filter": map[string]interface{}{
						"time": map[string]interface{}{
							"from": "now-1h",
							"to":   "now",
						},
						"list": []interface{}{
							map[string]interface{}{
								"name": "var1",
								"type": "query",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V2 Services Filter Migration Test",
				"schemaVersion": 2,
				"time": map[string]interface{}{
					"from": "now-1h",
					"to":   "now",
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "var1",
							"type": "query",
						},
					},
				},
			},
		},
		{
			name: "panel type conversion from graphite to graph",
			input: map[string]interface{}{
				"title":         "V2 Panel Type Migration Test",
				"schemaVersion": 1,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "graphite",
					},
					map[string]interface{}{
						"id":   2,
						"type": "table",
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V2 Panel Type Migration Test",
				"schemaVersion": 2,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "graph",
					},
					map[string]interface{}{
						"id":   2,
						"type": "table",
					},
				},
			},
		},
		{
			name: "legend boolean to object conversion for graph panels",
			input: map[string]interface{}{
				"title":         "V2 Legend Migration Test",
				"schemaVersion": 1,
				"panels": []interface{}{
					map[string]interface{}{
						"id":     1,
						"type":   "graph",
						"legend": true,
					},
					map[string]interface{}{
						"id":     2,
						"type":   "graph",
						"legend": false,
					},
					map[string]interface{}{
						"id":     3,
						"type":   "table",
						"legend": true, // Should not be migrated for non-graph panels
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V2 Legend Migration Test",
				"schemaVersion": 2,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "graph",
						"legend": map[string]interface{}{
							"show": true,
						},
					},
					map[string]interface{}{
						"id":   2,
						"type": "graph",
						"legend": map[string]interface{}{
							"show": false,
						},
					},
					map[string]interface{}{
						"id":     3,
						"type":   "table",
						"legend": true, // Unchanged for non-graph panels
					},
				},
			},
		},
		{
			name: "grid property migration for graph panels",
			input: map[string]interface{}{
				"title":         "V2 Grid Migration Test",
				"schemaVersion": 1,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "graph",
						"grid": map[string]interface{}{
							"min": 0,
							"max": 100,
						},
					},
					map[string]interface{}{
						"id":   2,
						"type": "graph",
						"grid": map[string]interface{}{
							"min": 10,
						},
					},
					map[string]interface{}{
						"id":   3,
						"type": "table",
						"grid": map[string]interface{}{
							"min": 0,
							"max": 100,
						}, // Should not be migrated for non-graph panels
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V2 Grid Migration Test",
				"schemaVersion": 2,
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "graph",
						"grid": map[string]interface{}{
							"leftMin": 0,
							"leftMax": 100,
						},
					},
					map[string]interface{}{
						"id":   2,
						"type": "graph",
						"grid": map[string]interface{}{
							"leftMin": 10,
						},
					},
					map[string]interface{}{
						"id":   3,
						"type": "table",
						"grid": map[string]interface{}{
							"min": 0,
							"max": 100,
						}, // Unchanged for non-graph panels
					},
				},
			},
		},
		{
			name: "y-format migration for graph panels",
			input: map[string]interface{}{
				"title":         "V2 Y-Format Migration Test",
				"schemaVersion": 1,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"type":      "graph",
						"y_format":  "short",
						"y2_format": "bytes",
					},
					map[string]interface{}{
						"id":       2,
						"type":     "graph",
						"y_format": "percent",
					},
					map[string]interface{}{
						"id":        3,
						"type":      "graph",
						"y2_format": "ms",
					},
					map[string]interface{}{
						"id":        4,
						"type":      "table",
						"y_format":  "short",
						"y2_format": "bytes", // Should not be migrated for non-graph panels
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V2 Y-Format Migration Test",
				"schemaVersion": 2,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"type":      "graph",
						"y_formats": []interface{}{"short", "bytes"},
					},
					map[string]interface{}{
						"id":        2,
						"type":      "graph",
						"y_formats": []interface{}{"percent", nil},
					},
					map[string]interface{}{
						"id":        3,
						"type":      "graph",
						"y_formats": []interface{}{nil, "ms"},
					},
					map[string]interface{}{
						"id":        4,
						"type":      "table",
						"y_format":  "short",
						"y2_format": "bytes", // Unchanged for non-graph panels
					},
				},
			},
		},
		{
			name: "comprehensive migration with all features",
			input: map[string]interface{}{
				"title":         "V2 Comprehensive Migration Test",
				"schemaVersion": 1,
				"services": map[string]interface{}{
					"filter": map[string]interface{}{
						"time": map[string]interface{}{
							"from": "now-6h",
							"to":   "now",
						},
						"list": []interface{}{
							map[string]interface{}{
								"name": "server",
								"type": "query",
							},
						},
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"type":      "graphite",
						"legend":    true,
						"y_format":  "short",
						"y2_format": "bytes",
						"grid": map[string]interface{}{
							"min": 0,
							"max": 100,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V2 Comprehensive Migration Test",
				"schemaVersion": 2,
				"time": map[string]interface{}{
					"from": "now-6h",
					"to":   "now",
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "server",
							"type": "query",
						},
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"id":   1,
						"type": "graph",
						"legend": map[string]interface{}{
							"show": true,
						},
						"y_formats": []interface{}{"short", "bytes"},
						"grid": map[string]interface{}{
							"leftMin": 0,
							"leftMax": 100,
						},
					},
				},
			},
		},
		{
			name: "dashboard with no services or panels",
			input: map[string]interface{}{
				"title":         "V2 Minimal Migration Test",
				"schemaVersion": 1,
			},
			expected: map[string]interface{}{
				"title":         "V2 Minimal Migration Test",
				"schemaVersion": 2,
			},
		},
		{
			name: "services filter with only time (no list)",
			input: map[string]interface{}{
				"title":         "V2 Services Time Only Test",
				"schemaVersion": 1,
				"services": map[string]interface{}{
					"filter": map[string]interface{}{
						"time": map[string]interface{}{
							"from": "now-2h",
							"to":   "now",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V2 Services Time Only Test",
				"schemaVersion": 2,
				"time": map[string]interface{}{
					"from": "now-2h",
					"to":   "now",
				},
			},
		},
		{
			name: "services filter with only list (no time)",
			input: map[string]interface{}{
				"title":         "V2 Services List Only Test",
				"schemaVersion": 1,
				"services": map[string]interface{}{
					"filter": map[string]interface{}{
						"list": []interface{}{
							map[string]interface{}{
								"name": "env",
								"type": "custom",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V2 Services List Only Test",
				"schemaVersion": 2,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "env",
							"type": "custom",
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V2)
}
