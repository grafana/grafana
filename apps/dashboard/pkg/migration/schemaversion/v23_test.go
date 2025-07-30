package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV23(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "multi variable with single value gets converted to array",
			input: map[string]interface{}{
				"title":         "V23 Multi Variable Single Value Test",
				"schemaVersion": 22,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "multi_single_value",
							"multi":   true,
							"current": map[string]interface{}{"value": "A", "text": "A", "selected": true},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V23 Multi Variable Single Value Test",
				"schemaVersion": 23,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "multi_single_value",
							"multi":   true,
							"current": map[string]interface{}{"value": []interface{}{"A"}, "text": []interface{}{"A"}, "selected": true},
						},
					},
				},
			},
		},
		{
			name: "multi variable with array value stays as array",
			input: map[string]interface{}{
				"title":         "V23 Multi Variable Array Value Test",
				"schemaVersion": 22,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "multi_array_value",
							"multi":   true,
							"current": map[string]interface{}{"value": []interface{}{"B", "C"}, "text": []interface{}{"B", "C"}, "selected": true},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V23 Multi Variable Array Value Test",
				"schemaVersion": 23,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "multi_array_value",
							"multi":   true,
							"current": map[string]interface{}{"value": []interface{}{"B", "C"}, "text": []interface{}{"B", "C"}, "selected": true},
						},
					},
				},
			},
		},
		{
			name: "non-multi variable with array value gets converted to single value",
			input: map[string]interface{}{
				"title":         "V23 Non-Multi Variable Array Value Test",
				"schemaVersion": 22,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "non_multi_array_value",
							"multi":   false,
							"current": map[string]interface{}{"value": []interface{}{"D"}, "text": []interface{}{"D"}, "selected": true},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V23 Non-Multi Variable Array Value Test",
				"schemaVersion": 23,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "non_multi_array_value",
							"multi":   false,
							"current": map[string]interface{}{"value": "D", "text": "D", "selected": true},
						},
					},
				},
			},
		},
		{
			name: "non-multi variable with single value stays as single value",
			input: map[string]interface{}{
				"title":         "V23 Non-Multi Variable Single Value Test",
				"schemaVersion": 22,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "non_multi_single_value",
							"multi":   false,
							"current": map[string]interface{}{"value": "E", "text": "E", "selected": true},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V23 Non-Multi Variable Single Value Test",
				"schemaVersion": 23,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "non_multi_single_value",
							"multi":   false,
							"current": map[string]interface{}{"value": "E", "text": "E", "selected": true},
						},
					},
				},
			},
		},
		{
			name: "variable without multi property is unchanged",
			input: map[string]interface{}{
				"title":         "V23 No Multi Property Test",
				"schemaVersion": 22,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "no_multi_property",
							"current": map[string]interface{}{"value": "F", "text": "F", "selected": true},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V23 No Multi Property Test",
				"schemaVersion": 23,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "no_multi_property",
							"current": map[string]interface{}{"value": "F", "text": "F", "selected": true},
						},
					},
				},
			},
		},
		{
			name: "variable with empty current is unchanged",
			input: map[string]interface{}{
				"title":         "V23 Empty Current Test",
				"schemaVersion": 22,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "empty_current",
							"multi":   true,
							"current": map[string]interface{}{},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V23 Empty Current Test",
				"schemaVersion": 23,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "empty_current",
							"multi":   true,
							"current": map[string]interface{}{},
						},
					},
				},
			},
		},
		{
			name: "variable with nil current is unchanged",
			input: map[string]interface{}{
				"title":         "V23 Nil Current Test",
				"schemaVersion": 22,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "nil_current",
							"multi":   true,
							"current": nil,
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V23 Nil Current Test",
				"schemaVersion": 23,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"type":    "query",
							"name":    "nil_current",
							"multi":   true,
							"current": nil,
						},
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V23)
}
