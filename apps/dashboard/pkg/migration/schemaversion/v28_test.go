package schemaversion

import (
	"context"
	"testing"
)

type migrationTestCase struct {
	name     string
	input    map[string]interface{}
	expected map[string]interface{}
}

func runMigrationTests(t *testing.T, tests []migrationTestCase, migrationFunc func(context.Context, map[string]interface{}) error) {
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a copy of the input
			dashboard := make(map[string]interface{})
			for k, v := range tt.input {
				dashboard[k] = v
			}

			err := migrationFunc(context.Background(), dashboard)
			if err != nil {
				t.Fatalf("Migration failed: %v", err)
			}

			// Verify the result matches expected
			if !deepEqual(dashboard, tt.expected) {
				t.Errorf("Migration result doesn't match expected.\nExpected: %+v\nGot: %+v", tt.expected, dashboard)
			}
		})
	}
}

func deepEqual(a, b interface{}) bool {
	// Simple deep comparison for test purposes
	// This is a simplified version - in production you'd use reflect.DeepEqual or similar
	switch aVal := a.(type) {
	case map[string]interface{}:
		bVal, ok := b.(map[string]interface{})
		if !ok || len(aVal) != len(bVal) {
			return false
		}
		for k, v := range aVal {
			if !deepEqual(v, bVal[k]) {
				return false
			}
		}
		return true
	case []interface{}:
		bVal, ok := b.([]interface{})
		if !ok || len(aVal) != len(bVal) {
			return false
		}
		for i, v := range aVal {
			if !deepEqual(v, bVal[i]) {
				return false
			}
		}
		return true
	default:
		return a == b
	}
}

func TestV28(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "v28 removes deprecated variable properties",
			input: map[string]interface{}{
				"title":         "V28 Variable Properties Migration Test Dashboard",
				"schemaVersion": 27,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":           "var1",
							"tags":           []interface{}{"tag1", "tag2"},
							"tagsQuery":      "query_string",
							"tagValuesQuery": "values_query",
							"useTags":        true,
							"type":           "query",
						},
						map[string]interface{}{
							"name":           "var2",
							"tags":           []interface{}{},
							"tagsQuery":      "",    // Empty string should not be removed
							"tagValuesQuery": "",    // Empty string should not be removed
							"useTags":        false, // False should not be removed
							"type":           "custom",
						},
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "singlestat",
						"title": "Singlestat Panel (unchanged by v28)",
						"id":    1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V28 Variable Properties Migration Test Dashboard",
				"schemaVersion": 28,
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "var1",
							"type": "query",
							// tags, tagsQuery, tagValuesQuery, useTags should be removed
						},
						map[string]interface{}{
							"name":           "var2",
							"tagsQuery":      "",    // Empty string preserved
							"tagValuesQuery": "",    // Empty string preserved
							"useTags":        false, // False preserved
							"type":           "custom",
							// only tags should be removed
						},
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "singlestat",
						"title": "Singlestat Panel (unchanged by v28)",
						"id":    1,
					},
				},
			},
		},
		{
			name: "v28 handles dashboard without templating",
			input: map[string]interface{}{
				"title":         "Dashboard without templating",
				"schemaVersion": 27,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "singlestat",
						"title": "Singlestat Panel",
						"id":    1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "Dashboard without templating",
				"schemaVersion": 28,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "singlestat",
						"title": "Singlestat Panel",
						"id":    1,
					},
				},
			},
		},
		{
			name: "v28 handles empty templating list",
			input: map[string]interface{}{
				"title":         "Dashboard with empty templating",
				"schemaVersion": 27,
				"templating": map[string]interface{}{
					"list": []interface{}{},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "singlestat",
						"title": "Singlestat Panel",
						"id":    1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "Dashboard with empty templating",
				"schemaVersion": 28,
				"templating": map[string]interface{}{
					"list": []interface{}{},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "singlestat",
						"title": "Singlestat Panel",
						"id":    1,
					},
				},
			},
		},
	}

	runMigrationTests(t, tests, V28)
}
