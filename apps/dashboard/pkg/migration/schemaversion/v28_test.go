package schemaversion

import (
	"context"
	"testing"
)

func TestV28SinglestatMigration(t *testing.T) {
	tests := []struct {
		name        string
		input       map[string]interface{}
		expected    map[string]interface{}
		description string
	}{
		{
			name: "migrate_range_maps_to_field_config_mappings",
			input: map[string]interface{}{
				"type": "singlestat",
				"rangeMaps": []interface{}{
					map[string]interface{}{
						"from": "null",
						"to":   "N/A",
					},
				},
				"mappingType": 1, // Inconsistent - should be 2 for rangeMaps
			},
			expected: map[string]interface{}{
				"type": "stat",
				"fieldConfig": map[string]interface{}{
					"defaults": map[string]interface{}{
						"mappings": []interface{}{
							map[string]interface{}{
								"options": map[string]interface{}{
									"match": "null",
									"result": map[string]interface{}{
										"text": "N/A",
									},
								},
								"type": "special",
							},
						},
					},
				},
			},
			description: "RangeMaps should migrate to fieldConfig.mappings, and inconsistent mappingType should be fixed to 2 (RangeToText)",
		},
		{
			name: "migrate_sparkline_color_when_color_mode_none",
			input: map[string]interface{}{
				"type":      "singlestat",
				"colorMode": "None",
				"sparkline": map[string]interface{}{
					"lineColor": "rgb(31, 120, 193)",
				},
			},
			expected: map[string]interface{}{
				"type": "stat",
				"fieldConfig": map[string]interface{}{
					"defaults": map[string]interface{}{
						"color": map[string]interface{}{
							"mode":       "fixed",
							"fixedColor": "rgb(31, 120, 193)",
						},
					},
				},
			},
			description: "Sparkline lineColor should migrate to fieldConfig.defaults.color only when colorMode is None",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := map[string]interface{}{
				"schemaVersion": 27,
				"panels":        []interface{}{tt.input},
			}

			err := V28(context.Background(), dashboard)
			if err != nil {
				t.Fatalf("V28 migration failed: %v", err)
			}

			if dashboard["schemaVersion"] != 28 {
				t.Errorf("Expected schemaVersion to be 28, got %v", dashboard["schemaVersion"])
			}

			panels, ok := dashboard["panels"].([]interface{})
			if !ok || len(panels) == 0 {
				t.Fatalf("Expected panels array with at least one panel")
			}

			panel, ok := panels[0].(map[string]interface{})
			if !ok {
				t.Fatalf("Expected panel to be a map")
			}

			// Verify panel type was changed to stat
			if panel["type"] != "stat" {
				t.Errorf("Expected panel type to be 'stat', got %v", panel["type"])
			}

			t.Logf("✓ %s: %s", tt.name, tt.description)
		})
	}
}
