package schemaversion

import (
	"context"
	"testing"
)

func TestV23TemplateVariableMigration(t *testing.T) {
	tests := []struct {
		name        string
		input       map[string]interface{}
		expected    map[string]interface{}
		description string
	}{
		{
			name: "align_text_with_multi_for_multi_variables",
			input: map[string]interface{}{
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":  "multiVar",
							"multi": true,
							"current": map[string]interface{}{
								"text":  "All",
								"value": "All",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":  "multiVar",
							"multi": true,
							"current": map[string]interface{}{
								"text":  []interface{}{"All"},
								"value": []interface{}{"All"},
							},
						},
					},
				},
			},
			description: "For multi variables, both text and value should be converted to arrays to match frontend alignCurrentWithMulti behavior",
		},
		{
			name: "preserve_text_as_string_when_value_already_array",
			input: map[string]interface{}{
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":  "multiVar",
							"multi": true,
							"current": map[string]interface{}{
								"text":  "All",
								"value": []interface{}{"All"},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":  "multiVar",
							"multi": true,
							"current": map[string]interface{}{
								"text":  "All",
								"value": []interface{}{"All"},
							},
						},
					},
				},
			},
			description: "When value is already an array, text should remain as string to match frontend behavior",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := map[string]interface{}{
				"schemaVersion": 22,
			}
			// Copy templating from input
			if templating, ok := tt.input["templating"]; ok {
				dashboard["templating"] = templating
			}

			err := V23(context.Background(), dashboard)
			if err != nil {
				t.Fatalf("V23 migration failed: %v", err)
			}

			if dashboard["schemaVersion"] != 23 {
				t.Errorf("Expected schemaVersion to be 23, got %v", dashboard["schemaVersion"])
			}

			// Verify templating structure
			templating, ok := dashboard["templating"].(map[string]interface{})
			if !ok {
				t.Fatalf("Expected templating to be a map")
			}

			list, ok := templating["list"].([]interface{})
			if !ok || len(list) == 0 {
				t.Fatalf("Expected templating.list to be a non-empty array")
			}

			variable, ok := list[0].(map[string]interface{})
			if !ok {
				t.Fatalf("Expected variable to be a map")
			}

			// Check current property alignment
			expectedTemplating := tt.expected["templating"].(map[string]interface{})
			expectedList := expectedTemplating["list"].([]interface{})
			expectedVariable := expectedList[0].(map[string]interface{})

			actualCurrent := variable["current"].(map[string]interface{})
			expectedCurrent := expectedVariable["current"].(map[string]interface{})

			if !compareValues(actualCurrent["text"], expectedCurrent["text"]) {
				t.Errorf("Text alignment failed. Expected: %v, Got: %v", expectedCurrent["text"], actualCurrent["text"])
			}

			if !compareValues(actualCurrent["value"], expectedCurrent["value"]) {
				t.Errorf("Value alignment failed. Expected: %v, Got: %v", expectedCurrent["value"], actualCurrent["value"])
			}

			t.Logf("✓ %s: %s", tt.name, tt.description)
		})
	}
}

// Helper function to compare values
func compareValues(actual, expected interface{}) bool {
	if actual == nil && expected == nil {
		return true
	}
	if actual == nil || expected == nil {
		return false
	}

	actualSlice, actualOk := actual.([]interface{})
	expectedSlice, expectedOk := expected.([]interface{})

	if actualOk && expectedOk {
		if len(actualSlice) != len(expectedSlice) {
			return false
		}
		for i, expectedValue := range expectedSlice {
			if actualSlice[i] != expectedValue {
				return false
			}
		}
		return true
	}

	return actual == expected
}
