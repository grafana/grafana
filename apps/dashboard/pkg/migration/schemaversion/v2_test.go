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
			name: "comprehensive services filter migration",
			input: map[string]interface{}{
				"title":         "V2 Comprehensive Services Migration Test",
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
						"id":    1,
						"type":  "graphite",
						"title": "CPU Usage",
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V2 Comprehensive Services Migration Test",
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
						"id":    1,
						"type":  "graphite", // Panel types are not migrated by V2 anymore
						"title": "CPU Usage",
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
		{
			name: "panels remain unchanged when no services filter",
			input: map[string]interface{}{
				"title":         "V2 Panels Unchanged Test",
				"schemaVersion": 1,
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
					map[string]interface{}{
						"id":   2,
						"type": "graph",
						"legend": map[string]interface{}{
							"show": false,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V2 Panels Unchanged Test",
				"schemaVersion": 2,
				"panels": []interface{}{
					map[string]interface{}{
						"id":        1,
						"type":      "graphite", // Panel migrations handled by auto-migration
						"legend":    true,
						"y_format":  "short",
						"y2_format": "bytes",
						"grid": map[string]interface{}{
							"min": 0,
							"max": 100,
						},
					},
					map[string]interface{}{
						"id":   2,
						"type": "graph",
						"legend": map[string]interface{}{
							"show": false,
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V2)
}
