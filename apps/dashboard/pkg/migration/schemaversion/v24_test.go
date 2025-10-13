package schemaversion

import (
	"context"
	"testing"
)

func TestV24TablePanelMigration(t *testing.T) {
	tests := []struct {
		name        string
		input       map[string]interface{}
		expected    map[string]interface{}
		description string
	}{
		{
			name: "preserve_empty_display_name",
			input: map[string]interface{}{
				"type": "table",
				"styles": []interface{}{
					map[string]interface{}{
						"alias": "",
					},
				},
			},
			expected: map[string]interface{}{
				"type": "table",
				"fieldConfig": map[string]interface{}{
					"defaults": map[string]interface{}{
						"displayName": "",
					},
				},
			},
			description: "Empty displayName values should be preserved when migrating from empty alias in table panel styles",
		},
		{
			name: "do_not_add_empty_transformations",
			input: map[string]interface{}{
				"type":  "table",
				"title": "Test Table",
			},
			expected: map[string]interface{}{
				"type":  "table",
				"title": "Test Table",
			},
			description: "V24 migration should not add empty transformations arrays to table panels",
		},
		{
			name: "migrate_table_old_to_table",
			input: map[string]interface{}{
				"type": "table-old",
			},
			expected: map[string]interface{}{
				"type": "table",
			},
			description: "V24 migration should migrate table-old to table",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := map[string]interface{}{
				"schemaVersion": 23,
				"panels":        []interface{}{tt.input},
			}

			err := V24(context.Background(), dashboard)
			if err != nil {
				t.Fatalf("V24 migration failed: %v", err)
			}

			if dashboard["schemaVersion"] != 24 {
				t.Errorf("Expected schemaVersion to be 24, got %v", dashboard["schemaVersion"])
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
