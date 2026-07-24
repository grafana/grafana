package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV6Migration(t *testing.T) {
	testCases := []migrationTestCase{
		{
			name: "pulldowns to annotations conversion with existing annotations",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"pulldowns": []interface{}{
					map[string]interface{}{
						"type":   "filtering",
						"enable": true,
					},
					map[string]interface{}{
						"type":   "annotations",
						"enable": true,
						"annotations": []interface{}{
							map[string]interface{}{
								"name":       "old annotation",
								"datasource": "prometheus",
								"enable":     true,
							},
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "server",
							"type": "filter",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"pulldowns": []interface{}{
					map[string]interface{}{
						"type":   "filtering",
						"enable": true,
					},
					map[string]interface{}{
						"type":   "annotations",
						"enable": true,
						"annotations": []interface{}{
							map[string]interface{}{
								"name":       "old annotation",
								"datasource": "prometheus",
								"enable":     true,
							},
						},
					},
				},
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "old annotation",
							"datasource": "prometheus",
							"enable":     true,
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "server",
							"type":       "query",
							"datasource": nil,
						},
					},
				},
			},
		},
		{
			name: "pulldowns to annotations conversion with empty annotations",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"pulldowns": []interface{}{
					map[string]interface{}{
						"type":   "annotations",
						"enable": true,
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"pulldowns": []interface{}{
					map[string]interface{}{
						"type":   "annotations",
						"enable": true,
					},
				},
				"annotations": map[string]interface{}{
					"list": []interface{}{},
				},
			},
		},
		{
			name: "no annotations pulldown found",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"pulldowns": []interface{}{
					map[string]interface{}{
						"type":   "filtering",
						"enable": true,
					},
					map[string]interface{}{
						"type":   "other",
						"enable": false,
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"pulldowns": []interface{}{
					map[string]interface{}{
						"type":   "filtering",
						"enable": true,
					},
					map[string]interface{}{
						"type":   "other",
						"enable": false,
					},
				},
			},
		},
		{
			name: "no pulldowns property",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"title":         "Test Dashboard",
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"title":         "Test Dashboard",
			},
		},
		{
			name: "empty pulldowns array",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"pulldowns":     []interface{}{},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"pulldowns":     []interface{}{},
			},
		},
		{
			name: "template variables migration - filter to query type",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "server",
							"type": "filter",
						},
						map[string]interface{}{
							"name": "metric",
							"type": "query",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "server",
							"type":       "query",
							"datasource": nil,
						},
						map[string]interface{}{
							"name":       "metric",
							"type":       "query",
							"datasource": nil,
						},
					},
				},
			},
		},
		{
			name: "template variables migration - missing type becomes query",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "server",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "server",
							"type":       "query",
							"datasource": nil,
						},
					},
				},
			},
		},
		{
			name: "template variables migration - existing datasource preserved",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "server",
							"type":       "query",
							"datasource": "prometheus",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "server",
							"type":       "query",
							"datasource": "prometheus",
						},
					},
				},
			},
		},
		{
			name: "template variables migration - allFormat removal",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":      "server",
							"type":      "query",
							"allFormat": nil,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "server",
							"type":       "query",
							"datasource": nil,
						},
					},
				},
			},
		},
		{
			name: "template variables migration - allFormat with value preserved",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":      "server",
							"type":      "query",
							"allFormat": "glob",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "server",
							"type":       "query",
							"datasource": nil,
							"allFormat":  "glob",
						},
					},
				},
			},
		},
		{
			name: "no templating property",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"title":         "Test Dashboard",
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"title":         "Test Dashboard",
			},
		},
		{
			name: "empty templating list",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"templating": map[string]interface{}{
					"list": []interface{}{},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"templating": map[string]interface{}{
					"list": []interface{}{},
				},
			},
		},
		{
			name: "complex dashboard with both pulldowns and templating",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"title":         "Complex Dashboard",
				"pulldowns": []interface{}{
					map[string]interface{}{
						"type":   "filtering",
						"enable": true,
					},
					map[string]interface{}{
						"type":   "annotations",
						"enable": true,
						"annotations": []interface{}{
							map[string]interface{}{
								"name":       "deployment",
								"datasource": "prometheus",
								"enable":     true,
								"iconColor":  "red",
							},
							map[string]interface{}{
								"name":       "alerts",
								"datasource": "loki",
								"enable":     false,
							},
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":      "environment",
							"type":      "filter",
							"allFormat": nil,
						},
						map[string]interface{}{
							"name":       "service",
							"datasource": "prometheus",
							"allFormat":  "glob",
						},
						map[string]interface{}{
							"name": "region",
							"type": "custom",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"title":         "Complex Dashboard",
				"pulldowns": []interface{}{
					map[string]interface{}{
						"type":   "filtering",
						"enable": true,
					},
					map[string]interface{}{
						"type":   "annotations",
						"enable": true,
						"annotations": []interface{}{
							map[string]interface{}{
								"name":       "deployment",
								"datasource": "prometheus",
								"enable":     true,
								"iconColor":  "red",
							},
							map[string]interface{}{
								"name":       "alerts",
								"datasource": "loki",
								"enable":     false,
							},
						},
					},
				},
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "deployment",
							"datasource": "prometheus",
							"enable":     true,
							"iconColor":  "red",
						},
						map[string]interface{}{
							"name":       "alerts",
							"datasource": "loki",
							"enable":     false,
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "environment",
							"type":       "query",
							"datasource": nil,
						},
						map[string]interface{}{
							"name":       "service",
							"type":       "query",
							"datasource": "prometheus",
							"allFormat":  "glob",
						},
						map[string]interface{}{
							"name":       "region",
							"type":       "custom",
							"datasource": nil,
						},
					},
				},
			},
		},
		{
			name: "invalid pulldowns structure",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"pulldowns":     "invalid_structure",
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"pulldowns":     "invalid_structure",
			},
		},
		{
			name: "invalid templating structure",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"templating":    "invalid_structure",
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"templating":    "invalid_structure",
			},
		},
		{
			name: "invalid templating list structure",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"templating": map[string]interface{}{
					"list": "invalid_list",
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"templating": map[string]interface{}{
					"list": "invalid_list",
				},
			},
		},
		{
			name: "pulldown item with invalid structure",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"pulldowns": []interface{}{
					"invalid_pulldown",
					map[string]interface{}{
						"type":   "annotations",
						"enable": true,
						"annotations": []interface{}{
							map[string]interface{}{
								"name": "valid annotation",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"pulldowns": []interface{}{
					"invalid_pulldown",
					map[string]interface{}{
						"type":   "annotations",
						"enable": true,
						"annotations": []interface{}{
							map[string]interface{}{
								"name": "valid annotation",
							},
						},
					},
				},
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "valid annotation",
						},
					},
				},
			},
		},
		{
			name: "template variable with invalid structure",
			input: map[string]interface{}{
				"schemaVersion": 5,
				"templating": map[string]interface{}{
					"list": []interface{}{
						"invalid_variable",
						map[string]interface{}{
							"name": "valid_variable",
							"type": "filter",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 6,
				"templating": map[string]interface{}{
					"list": []interface{}{
						"invalid_variable",
						map[string]interface{}{
							"name":       "valid_variable",
							"type":       "query",
							"datasource": nil,
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, testCases, schemaversion.V6)
}
