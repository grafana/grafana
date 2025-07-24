package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV27(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "remove repeated panels with repeatPanelId and repeatByRow",
			input: map[string]interface{}{
				"schemaVersion": 26,
				"panels": []interface{}{
					map[string]interface{}{
						"id":            1,
						"type":          "graph",
						"title":         "Repeated Panel 1",
						"repeatPanelId": "panel1",
					},
					map[string]interface{}{
						"id":          2,
						"type":        "graph",
						"title":       "Repeated Panel 2",
						"repeatByRow": true,
					},
					map[string]interface{}{
						"id":    3,
						"type":  "graph",
						"title": "Normal Panel",
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    3,
						"type":  "graph",
						"title": "Normal Panel",
					},
				},
			},
		},
		{
			name: "filter repeated panels in row panels",
			input: map[string]interface{}{
				"schemaVersion": 26,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "row",
						"title": "Row with repeated panels",
						"panels": []interface{}{
							map[string]interface{}{
								"id":            2,
								"type":          "graph",
								"title":         "Repeated nested panel",
								"repeatPanelId": "nested_panel1",
							},
							map[string]interface{}{
								"id":    3,
								"type":  "graph",
								"title": "Normal nested panel",
							},
						},
					},
					map[string]interface{}{
						"id":    4,
						"type":  "graph",
						"title": "Normal panel outside row",
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "row",
						"title": "Row with repeated panels",
						"panels": []interface{}{
							map[string]interface{}{
								"id":    3,
								"type":  "graph",
								"title": "Normal nested panel",
							},
						},
					},
					map[string]interface{}{
						"id":    4,
						"type":  "graph",
						"title": "Normal panel outside row",
					},
				},
			},
		},
		{
			name: "migrate constant variable to textbox with hide=0",
			input: map[string]interface{}{
				"schemaVersion": 26,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":  "constant_var",
							"type":  "constant",
							"query": "default_value",
							"hide":  0.0,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 27,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":  "constant_var",
							"type":  "textbox",
							"query": "default_value",
							"hide":  0.0,
							"current": map[string]interface{}{
								"selected": true,
								"text":     "default_value",
								"value":    "default_value",
							},
							"options": []interface{}{
								map[string]interface{}{
									"selected": true,
									"text":     "default_value",
									"value":    "default_value",
								},
							},
						},
					},
				},
			},
		},
		{
			name: "do not migrate non-constant variable",
			input: map[string]interface{}{
				"schemaVersion": 26,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":  "query_var",
							"type":  "query",
							"query": "some_query",
							"hide":  0.0,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 27,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":  "query_var",
							"type":  "query",
							"query": "some_query",
							"hide":  0.0,
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V27)
}
