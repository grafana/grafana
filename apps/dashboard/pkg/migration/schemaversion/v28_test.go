package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

func TestV28(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "singlestat panels get migrated to stat/gauge",
			input: map[string]interface{}{
				"title":         "V28 Singlestat Migration Test Dashboard",
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "singlestat",
						"title": "Singlestat to Stat",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "up"},
						},
					},
					map[string]interface{}{
						"id":    2,
						"type":  "singlestat",
						"title": "Singlestat to Gauge",
						"gauge": map[string]interface{}{"show": true},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "up"},
						},
					},
					map[string]interface{}{
						"id":    3,
						"type":  "singlestat",
						"title": "Singlestat with Gauge Disabled",
						"gauge": map[string]interface{}{"show": false},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "up"},
						},
					},
					map[string]interface{}{
						"id":    4,
						"type":  "timeseries",
						"title": "Non-singlestat Panel",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "up"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V28 Singlestat Migration Test Dashboard",
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "grafana-singlestat-panel",
						"title": "Singlestat to Stat",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "up"},
						},
					},
					map[string]interface{}{
						"id":    2,
						"type":  "grafana-singlestat-panel",
						"title": "Singlestat to Gauge",
						"gauge": map[string]interface{}{"show": true},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "up"},
						},
					},
					map[string]interface{}{
						"id":    3,
						"type":  "grafana-singlestat-panel",
						"title": "Singlestat with Gauge Disabled",
						"gauge": map[string]interface{}{"show": false},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "up"},
						},
					},
					map[string]interface{}{
						"id":    4,
						"type":  "timeseries",
						"title": "Non-singlestat Panel",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "up"},
						},
					},
				},
			},
		},
		{
			name: "deprecated variable properties get removed",
			input: map[string]interface{}{
				"title":         "V28 Variable Properties Migration Test Dashboard",
				"schemaVersion": 27,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "var1",
							"type":           "query",
							"tags":           []interface{}{"tag1", "tag2"},
							"tagsQuery":      "tags query",
							"tagValuesQuery": "tag values query",
							"useTags":        true,
							"datasource":     "prometheus",
						},
						map[string]interface{}{
							"name":      "var2",
							"type":      "custom",
							"tags":      []interface{}{"tag3"},
							"tagsQuery": "another query",
							"useTags":   false,
							"options":   []interface{}{map[string]interface{}{"text": "A", "value": "A"}},
						},
						map[string]interface{}{
							"name":    "var3",
							"type":    "textbox",
							"options": []interface{}{map[string]interface{}{"text": "Hello", "value": "World"}},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V28 Variable Properties Migration Test Dashboard",
				"schemaVersion": 28,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "var1",
							"type":       "query",
							"datasource": "prometheus",
						},
						map[string]interface{}{
							"name":    "var2",
							"type":    "custom",
							"options": []interface{}{map[string]interface{}{"text": "A", "value": "A"}},
						},
						map[string]interface{}{
							"name":    "var3",
							"type":    "textbox",
							"options": []interface{}{map[string]interface{}{"text": "Hello", "value": "World"}},
						},
					},
				},
			},
		},
		{
			name: "mixed migration scenarios",
			input: map[string]interface{}{
				"title":         "V28 Mixed Migration Test Dashboard",
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "singlestat",
						"title": "Mixed Singlestat",
						"gauge": map[string]interface{}{"show": true},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "up"},
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "mixed_var",
							"type":           "query",
							"tags":           []interface{}{"tag1"},
							"tagValuesQuery": "values query",
							"datasource":     "prometheus",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V28 Mixed Migration Test Dashboard",
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "grafana-singlestat-panel",
						"title": "Mixed Singlestat",
						"gauge": map[string]interface{}{"show": true},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "up"},
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":       "mixed_var",
							"type":       "query",
							"datasource": "prometheus",
						},
					},
				},
			},
		},
		{
			name: "no panels or variables to migrate",
			input: map[string]interface{}{
				"title":         "V28 No Migration Test Dashboard",
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "timeseries",
						"title": "Timeseries Panel",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "up"},
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":    "clean_var",
							"type":    "custom",
							"options": []interface{}{map[string]interface{}{"text": "A", "value": "A"}},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V28 No Migration Test Dashboard",
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "timeseries",
						"title": "Timeseries Panel",
						"targets": []interface{}{
							map[string]interface{}{"refId": "A", "expr": "up"},
						},
					},
				},
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":    "clean_var",
							"type":    "custom",
							"options": []interface{}{map[string]interface{}{"text": "A", "value": "A"}},
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V28(testutil.GetTestPanelProvider()))
}
