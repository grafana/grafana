package schemaversion

import (
	"context"
	"testing"
)

func TestV33DatasourceMigration(t *testing.T) {
	// Create test datasource provider
	dsProvider := &testDataSourceProvider{
		datasources: []DataSourceInfo{
			{
				Default:    true,
				UID:        "default-ds-uid",
				Type:       "prometheus",
				APIVersion: "v1",
				Name:       "Default Test Datasource Name",
				ID:         1,
			},
			{
				Default:    false,
				UID:        "non-default-test-ds-uid",
				Type:       "loki",
				APIVersion: "v1",
				Name:       "Non Default Test Datasource Name",
				ID:         2,
			},
		},
	}

	tests := []struct {
		name        string
		input       map[string]interface{}
		expected    map[string]interface{}
		description string
	}{
		{
			name: "empty_string_datasource_should_become_empty_object",
			input: map[string]interface{}{
				"datasource": "",
				"targets": []interface{}{
					map[string]interface{}{
						"refId":      "A",
						"datasource": "",
					},
				},
			},
			expected: map[string]interface{}{
				"datasource": map[string]interface{}{},
				"targets": []interface{}{
					map[string]interface{}{
						"refId":      "A",
						"datasource": map[string]interface{}{},
					},
				},
			},
			description: "Empty string datasources should migrate to empty objects {} to match frontend behavior",
		},
		{
			name: "null_datasource_should_remain_null",
			input: map[string]interface{}{
				"datasource": nil,
			},
			expected: map[string]interface{}{
				"datasource": nil,
			},
			description: "Null datasources should remain null when returnDefaultAsNull is true",
		},
		{
			name: "existing_object_datasource_should_remain_unchanged",
			input: map[string]interface{}{
				"datasource": map[string]interface{}{
					"uid":  "existing-ref-uid",
					"type": "prometheus",
				},
			},
			expected: map[string]interface{}{
				"datasource": map[string]interface{}{
					"uid":  "existing-ref-uid",
					"type": "prometheus",
				},
			},
			description: "Existing datasource objects should remain unchanged",
		},
		{
			name: "string_datasource_should_migrate_to_object",
			input: map[string]interface{}{
				"datasource": "Non Default Test Datasource Name",
			},
			expected: map[string]interface{}{
				"datasource": map[string]interface{}{
					"uid":        "non-default-test-ds-uid",
					"type":       "loki",
					"apiVersion": "v1",
				},
			},
			description: "String datasources should migrate to structured objects with uid, type, and apiVersion",
		},
		{
			name: "default_datasource_should_become_null",
			input: map[string]interface{}{
				"datasource": "default",
			},
			expected: map[string]interface{}{
				"datasource": nil,
			},
			description: "Default datasource should become null when returnDefaultAsNull is true",
		},
		{
			name: "unknown_datasource_should_be_preserved_as_uid",
			input: map[string]interface{}{
				"datasource": "unknown-datasource",
			},
			expected: map[string]interface{}{
				"datasource": map[string]interface{}{
					"uid": "unknown-datasource",
				},
			},
			description: "Unknown datasource names should be preserved as UID-only reference",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a dashboard with the test panel
			dashboard := map[string]interface{}{
				"schemaVersion": 32,
				"panels": []interface{}{
					tt.input,
				},
			}

			// Run V33 migration
			migration := V33(dsProvider)
			err := migration(context.Background(), dashboard)
			if err != nil {
				t.Fatalf("V33 migration failed: %v", err)
			}

			// Verify schema version was updated
			if dashboard["schemaVersion"] != 33 {
				t.Errorf("Expected schemaVersion to be 33, got %v", dashboard["schemaVersion"])
			}

			// Get the migrated panel
			panels, ok := dashboard["panels"].([]interface{})
			if !ok || len(panels) == 0 {
				t.Fatalf("Expected panels array with at least one panel")
			}

			panel, ok := panels[0].(map[string]interface{})
			if !ok {
				t.Fatalf("Expected panel to be a map")
			}

			// Verify panel datasource
			if !compareDatasource(panel["datasource"], tt.expected["datasource"]) {
				t.Errorf("Panel datasource mismatch.\nExpected: %v\nGot: %v", tt.expected["datasource"], panel["datasource"])
			}

			// Verify targets if they exist
			if expectedTargets, hasTargets := tt.expected["targets"].([]interface{}); hasTargets {
				actualTargets, ok := panel["targets"].([]interface{})
				if !ok {
					t.Fatalf("Expected targets array")
				}

				if len(actualTargets) != len(expectedTargets) {
					t.Fatalf("Expected %d targets, got %d", len(expectedTargets), len(actualTargets))
				}

				for i, expectedTarget := range expectedTargets {
					expectedTargetMap := expectedTarget.(map[string]interface{})
					actualTargetMap := actualTargets[i].(map[string]interface{})

					if !compareDatasource(actualTargetMap["datasource"], expectedTargetMap["datasource"]) {
						t.Errorf("Target %d datasource mismatch.\nExpected: %v\nGot: %v", i, expectedTargetMap["datasource"], actualTargetMap["datasource"])
					}
				}
			}

			t.Logf("✓ %s: %s", tt.name, tt.description)
		})
	}
}

// Helper function to compare datasource objects
func compareDatasource(actual, expected interface{}) bool {
	if actual == nil && expected == nil {
		return true
	}
	if actual == nil || expected == nil {
		return false
	}

	actualMap, actualOk := actual.(map[string]interface{})
	expectedMap, expectedOk := expected.(map[string]interface{})

	if !actualOk || !expectedOk {
		return actual == expected
	}

	if len(actualMap) != len(expectedMap) {
		return false
	}

	for key, expectedValue := range expectedMap {
		actualValue, exists := actualMap[key]
		if !exists || actualValue != expectedValue {
			return false
		}
	}

	return true
}

// Test datasource provider for testing
type testDataSourceProvider struct {
	datasources []DataSourceInfo
}

func (p *testDataSourceProvider) GetDataSourceInfo(_ context.Context) []DataSourceInfo {
	return p.datasources
}
