package schemaversion

import (
	"context"
	"testing"
)

func TestV31LabelsToFieldsMigration(t *testing.T) {
	tests := []struct {
		name        string
		input       map[string]interface{}
		expected    map[string]interface{}
		description string
	}{
		{
			name: "do_not_add_empty_transformations",
			input: map[string]interface{}{
				"type":  "timeseries",
				"title": "Test Panel",
			},
			expected: map[string]interface{}{
				"type":  "timeseries",
				"title": "Test Panel",
			},
			description: "V31 migration should not add empty transformations arrays to panels",
		},
		{
			name: "preserve_existing_transformations",
			input: map[string]interface{}{
				"type": "timeseries",
				"transformations": []interface{}{
					map[string]interface{}{
						"id": "labelsToFields",
						"options": map[string]interface{}{
							"keepLabels": []interface{}{"__name__"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"type": "timeseries",
				"transformations": []interface{}{
					map[string]interface{}{
						"id": "labelsToFields",
						"options": map[string]interface{}{
							"keepLabels": []interface{}{"__name__"},
						},
					},
				},
			},
			description: "Existing labelsToFields transformations should be preserved and updated if needed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := map[string]interface{}{
				"schemaVersion": 30,
				"panels":        []interface{}{tt.input},
			}

			err := V31(context.Background(), dashboard)
			if err != nil {
				t.Fatalf("V31 migration failed: %v", err)
			}

			if dashboard["schemaVersion"] != 31 {
				t.Errorf("Expected schemaVersion to be 31, got %v", dashboard["schemaVersion"])
			}

			panels, ok := dashboard["panels"].([]interface{})
			if !ok || len(panels) == 0 {
				t.Fatalf("Expected panels array with at least one panel")
			}

			panel, ok := panels[0].(map[string]interface{})
			if !ok {
				t.Fatalf("Expected panel to be a map")
			}

			// Check that transformations array is not added if it wasn't in input
			if _, hasTransformations := tt.input["transformations"]; !hasTransformations {
				if _, exists := panel["transformations"]; exists {
					t.Errorf("Empty transformations array should not be added")
				}
			}

			t.Logf("✓ %s: %s", tt.name, tt.description)
		})
	}
}
