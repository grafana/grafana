package migration

import (
	"testing"
)

// copyMap creates a deep copy of a map[string]interface{} for testing
func copyMap(src map[string]interface{}) map[string]interface{} {
	dst := make(map[string]interface{})
	for k, v := range src {
		dst[k] = v
	}
	return dst
}

// assertPropertyRemoved checks that a property has been removed from the map
func assertPropertyRemoved(t *testing.T, obj map[string]interface{}, key string) {
	if _, exists := obj[key]; exists {
		t.Errorf("Property %s should have been removed but still exists", key)
	}
}

// assertPropertyValue checks that a property has the expected value
func assertPropertyValue(t *testing.T, obj map[string]interface{}, key string, expected interface{}) {
	if actual, exists := obj[key]; !exists {
		t.Errorf("Property %s should exist but is missing", key)
	} else if !compareValues(actual, expected) {
		t.Errorf("Property %s has wrong value. Expected: %v, Got: %v", key, expected, actual)
	}
}

// assertPropertiesExist checks that all expected properties exist with correct values
func assertPropertiesExist(t *testing.T, obj map[string]interface{}, expected map[string]interface{}) {
	for key, expectedValue := range expected {
		assertPropertyValue(t, obj, key, expectedValue)
	}
}

// assertPropertiesRemoved checks that all specified properties have been removed
func assertPropertiesRemoved(t *testing.T, obj map[string]interface{}, unwantedProps []string) {
	for _, prop := range unwantedProps {
		assertPropertyRemoved(t, obj, prop)
	}
}

func TestFrontendDefaultsCleanup(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "remove_dashboard_id_null",
			input: map[string]interface{}{
				"id":    nil,
				"title": "Test Dashboard",
			},
			expected: map[string]interface{}{
				"title": "Test Dashboard",
			},
		},
		{
			name: "remove_version_property",
			input: map[string]interface{}{
				"version": float64(123),
				"title":   "Test Dashboard",
			},
			expected: map[string]interface{}{
				"title": "Test Dashboard",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := copyMap(tt.input)

			cleanupDashboardDefaults(dashboard)

			// Check that expected properties exist
			for key, expectedValue := range tt.expected {
				assertPropertyValue(t, dashboard, key, expectedValue)
			}

			// Check that version is always removed
			assertPropertyRemoved(t, dashboard, "version")

			// Check that id is removed when it was null in input
			if idValue, exists := tt.input["id"]; exists && idValue == nil {
				assertPropertyRemoved(t, dashboard, "id")
			}
		})
	}
}

func TestCleanupDashboardForSave(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "remove_non_persisted_properties",
			input: map[string]interface{}{
				"title":        "Test Dashboard",
				"meta":         map[string]interface{}{"canEdit": true},
				"events":       map[string]interface{}{},
				"originalTime": "2023-01-01",
				"variables":    map[string]interface{}{"list": []interface{}{}},
			},
			expected: map[string]interface{}{
				"title": "Test Dashboard",
				// meta, events, originalTime, variables should be removed
			},
		},
		{
			name: "remove_null_values",
			input: map[string]interface{}{
				"title":  "Test Dashboard",
				"gnetId": nil,
			},
			expected: map[string]interface{}{
				"title": "Test Dashboard",
				// gnetId should be removed
			},
		},
		{
			name: "cleanup_templating_and_panels",
			input: map[string]interface{}{
				"title": "Test Dashboard",
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":  "var1",
							"index": -1, // Should be removed
						},
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"type":   "timeseries",
						"title":  "",                       // Default value, should be removed
						"events": map[string]interface{}{}, // Not persisted, should be removed
					},
				},
			},
			expected: map[string]interface{}{
				"title": "Test Dashboard",
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "var1",
							// index should be removed
						},
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						// title and events should be removed
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := copyMap(tt.input)

			cleanupDashboardForSave(dashboard)

			// Verify expected properties exist
			assertPropertiesExist(t, dashboard, tt.expected)

			// Verify unwanted properties are removed
			unwantedProps := []string{"meta", "events", "originalTime", "variables", "gnetId"}
			assertPropertiesRemoved(t, dashboard, unwantedProps)
		})
	}
}

func TestCleanupVariable(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "cleanup_query_variable",
			input: map[string]interface{}{
				"type":       "query",
				"name":       "var1",
				"datasource": nil,
				"index":      -1,
			},
			expected: map[string]interface{}{
				"type":    "query",
				"name":    "var1",
				"options": []interface{}{},
				// datasource and index should be removed
			},
		},
		{
			name: "cleanup_constant_variable",
			input: map[string]interface{}{
				"type":    "constant",
				"name":    "var2",
				"value":   "constant_value",
				"options": []interface{}{"option1"},
				"index":   -1,
			},
			expected: map[string]interface{}{
				"type":  "constant",
				"name":  "var2",
				"value": "constant_value",
				// options and index should be removed
			},
		},
		{
			name: "cleanup_datasource_variable",
			input: map[string]interface{}{
				"type":  "datasource",
				"name":  "var3",
				"index": -1,
			},
			expected: map[string]interface{}{
				"type":    "datasource",
				"name":    "var3",
				"options": []interface{}{},
				// index should be removed
			},
		},
		{
			name: "cleanup_custom_variable",
			input: map[string]interface{}{
				"type":    "custom",
				"name":    "var4",
				"options": []interface{}{"option1", "option2"},
				"index":   -1,
			},
			expected: map[string]interface{}{
				"type":    "custom",
				"name":    "var4",
				"options": []interface{}{"option1", "option2"},
				// index should be removed
			},
		},
		{
			name: "cleanup_textbox_variable",
			input: map[string]interface{}{
				"type":  "textbox",
				"name":  "var5",
				"value": "text_value",
				"index": -1,
			},
			expected: map[string]interface{}{
				"type":  "textbox",
				"name":  "var5",
				"value": "text_value",
				// index should be removed
			},
		},
		{
			name: "cleanup_adhoc_variable",
			input: map[string]interface{}{
				"type":    "adhoc",
				"name":    "var6",
				"filters": []interface{}{},
				"index":   -1,
			},
			expected: map[string]interface{}{
				"type":    "adhoc",
				"name":    "var6",
				"filters": []interface{}{},
				// index should be removed
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			variable := make(map[string]interface{})
			for k, v := range tt.input {
				variable[k] = v
			}

			cleanupVariable(variable)

			// Verify expected properties exist
			assertPropertiesExist(t, variable, tt.expected)

			// Verify unwanted properties are removed
			assertPropertyRemoved(t, variable, "index")
		})
	}
}

func TestCleanupPanels(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "filter_repeated_panels",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel 1",
					},
					map[string]interface{}{
						"type":          "table",
						"title":         "Panel 2",
						"repeatPanelId": 1, // Should be filtered out
					},
					map[string]interface{}{
						"type":          "graph",
						"title":         "Panel 3",
						"repeatedByRow": "row1", // Should be filtered out
					},
					map[string]interface{}{
						"type":  "stat",
						"title": "Panel 4",
					},
				},
			},
			expected: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel 1",
					},
					map[string]interface{}{
						"type":  "stat",
						"title": "Panel 4",
					},
				},
			},
		},
		{
			name: "cleanup_panel_properties",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"type":       "timeseries",
						"title":      "",                                       // Default value, should be removed
						"events":     map[string]interface{}{},                 // Not persisted, should be removed
						"scopedVars": map[string]interface{}{"var1": "value1"}, // Should be removed
					},
				},
			},
			expected: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"type": "timeseries",
						// title, events, scopedVars should be removed
					},
				},
			},
		},
		{
			name: "ensure_panels_property_exists",
			input: map[string]interface{}{
				"title": "Test Dashboard",
			},
			expected: map[string]interface{}{
				"title":  "Test Dashboard",
				"panels": []interface{}{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := copyMap(tt.input)

			cleanupPanels(dashboard)

			// Verify expected properties exist
			assertPropertiesExist(t, dashboard, tt.expected)
		})
	}
}

func TestCleanupRowPanelProperties(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "remove_empty_repeat_from_row_panel",
			input: map[string]interface{}{
				"type":      "row",
				"title":     "Row Panel",
				"repeat":    "", // Empty string, should be removed
				"collapsed": false,
			},
			expected: map[string]interface{}{
				"type":      "row",
				"title":     "Row Panel",
				"collapsed": false, // Should be preserved
				// repeat should be removed
			},
		},
		{
			name: "preserve_non_empty_repeat_in_row_panel",
			input: map[string]interface{}{
				"type":      "row",
				"title":     "Row Panel",
				"repeat":    "server", // Non-empty, should be preserved
				"collapsed": false,
			},
			expected: map[string]interface{}{
				"type":      "row",
				"title":     "Row Panel",
				"repeat":    "server",
				"collapsed": false,
			},
		},
		{
			name: "no_changes_for_non_row_panel",
			input: map[string]interface{}{
				"type":   "timeseries",
				"title":  "Timeseries Panel",
				"repeat": "", // Should not be removed for non-row panels
			},
			expected: map[string]interface{}{
				"type":   "timeseries",
				"title":  "Timeseries Panel",
				"repeat": "", // Should be preserved
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			panel := make(map[string]interface{})
			for k, v := range tt.input {
				panel[k] = v
			}

			cleanupRowPanelProperties(panel)

			// Verify expected properties exist
			assertPropertiesExist(t, panel, tt.expected)
		})
	}
}

func TestCleanupFieldConfigDefaults(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		panel    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "remove_empty_custom_from_migrated_singlestat",
			input: map[string]interface{}{
				"custom": map[string]interface{}{},
				"color": map[string]interface{}{
					"mode":       "fixed",
					"fixedColor": "red",
				},
				"mappings": []interface{}{},
			},
			panel: map[string]interface{}{
				"autoMigrateFrom": "singlestat",
			},
			expected: map[string]interface{}{
				"color": map[string]interface{}{
					"mode":       "fixed",
					"fixedColor": "red",
				},
				"mappings": []interface{}{},
				// custom should be removed
			},
		},
		{
			name: "preserve_empty_custom_from_non_migrated_panel",
			input: map[string]interface{}{
				"custom": map[string]interface{}{},
				"color": map[string]interface{}{
					"mode":       "fixed",
					"fixedColor": "red",
				},
			},
			panel: map[string]interface{}{
				"type": "timeseries",
			},
			expected: map[string]interface{}{
				"custom": map[string]interface{}{}, // Should be preserved
				"color": map[string]interface{}{
					"mode":       "fixed",
					"fixedColor": "red",
				},
			},
		},
		{
			name: "preserve_non_empty_custom",
			input: map[string]interface{}{
				"custom": map[string]interface{}{
					"displayMode": "list",
				},
				"color": map[string]interface{}{
					"mode":       "fixed",
					"fixedColor": "red",
				},
			},
			panel: map[string]interface{}{
				"autoMigrateFrom": "singlestat",
			},
			expected: map[string]interface{}{
				"custom": map[string]interface{}{
					"displayMode": "list",
				},
				"color": map[string]interface{}{
					"mode":       "fixed",
					"fixedColor": "red",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			defaults := make(map[string]interface{})
			for k, v := range tt.input {
				defaults[k] = v
			}

			panel := make(map[string]interface{})
			for k, v := range tt.panel {
				panel[k] = v
			}

			cleanupFieldConfigDefaults(defaults, panel)

			// Verify expected properties exist
			assertPropertiesExist(t, defaults, tt.expected)
		})
	}
}

// TestApplyFrontendDefaults tests the core dashboard defaults application logic
func TestApplyFrontendDefaults(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "apply_dashboard_defaults",
			input: map[string]interface{}{
				"schemaVersion": float64(42),
			},
			expected: map[string]interface{}{
				"title":                "No Title",
				"tags":                 []interface{}{},
				"timezone":             "",
				"weekStart":            "",
				"editable":             true,
				"graphTooltip":         float64(0),
				"time":                 map[string]interface{}{"from": "now-6h", "to": "now"},
				"timepicker":           map[string]interface{}{},
				"schemaVersion":        float64(42), // Preserved from input
				"fiscalYearStartMonth": float64(0),
				// version is NOT set as default - managed by backend metadata
				"links": []interface{}{},
			},
		},
		{
			name: "preserve_existing_values",
			input: map[string]interface{}{
				"title":    "Custom Title",
				"editable": false,
				"tags":     []interface{}{"tag1", "tag2"},
			},
			expected: map[string]interface{}{
				"title":                "Custom Title",                // Preserved
				"editable":             false,                         // Preserved
				"tags":                 []interface{}{"tag1", "tag2"}, // Preserved
				"timezone":             "",
				"weekStart":            "",
				"graphTooltip":         float64(0),
				"time":                 map[string]interface{}{"from": "now-6h", "to": "now"},
				"timepicker":           map[string]interface{}{},
				"schemaVersion":        float64(0),
				"fiscalYearStartMonth": float64(0),
				// version is NOT set as default - managed by backend metadata
				"links": []interface{}{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := copyMap(tt.input)

			applyFrontendDefaults(dashboard)

			// Verify expected properties exist
			for key, expectedValue := range tt.expected {
				if actualValue, exists := dashboard[key]; !exists {
					t.Errorf("Property %s should exist but is missing", key)
				} else if !compareValues(actualValue, expectedValue) {
					t.Errorf("Property %s has wrong value. Expected: %v (type: %T), Got: %v (type: %T)", key, expectedValue, expectedValue, actualValue, actualValue)
				}
			}

			// Verify that version is NOT set as default (unless it was in input)
			if _, hadVersionInInput := tt.input["version"]; !hadVersionInInput {
				if _, hasVersion := dashboard["version"]; hasVersion {
					t.Errorf("Property version should not be set as default but was found")
				}
			}
		})
	}
}

// TestApplyPanelDefaults tests the core panel defaults application logic
func TestApplyPanelDefaults(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "apply_panel_defaults",
			input: map[string]interface{}{
				"type": "timeseries",
			},
			expected: map[string]interface{}{
				"type": "timeseries",
				"gridPos": map[string]interface{}{
					"x": float64(0), "y": float64(0), "h": float64(3), "w": float64(6),
				},
				"targets": []interface{}{
					map[string]interface{}{"refId": "A"},
				},
				"cachedPluginOptions": map[string]interface{}{},
				"transparent":         false,
				"options":             map[string]interface{}{},
				"links":               []interface{}{},
				"fieldConfig": map[string]interface{}{
					"defaults":  map[string]interface{}{},
					"overrides": []interface{}{},
				},
				"title": "",
			},
		},
		{
			name: "preserve_existing_panel_values",
			input: map[string]interface{}{
				"type":        "table",
				"title":       "Custom Panel",
				"transparent": true,
				"gridPos": map[string]interface{}{
					"x": float64(12), "y": float64(0), "h": float64(8), "w": float64(12),
				},
			},
			expected: map[string]interface{}{
				"type":        "table",
				"title":       "Custom Panel", // Preserved
				"transparent": true,           // Preserved
				"gridPos": map[string]interface{}{ // Preserved
					"x": float64(12), "y": float64(0), "h": float64(8), "w": float64(12),
				},
				"targets": []interface{}{
					map[string]interface{}{"refId": "A"},
				},
				"cachedPluginOptions": map[string]interface{}{},
				"options":             map[string]interface{}{},
				"links":               []interface{}{},
				"fieldConfig": map[string]interface{}{
					"defaults":  map[string]interface{}{},
					"overrides": []interface{}{},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			panel := make(map[string]interface{})
			for k, v := range tt.input {
				panel[k] = v
			}

			applyPanelDefaults(panel)

			// Verify expected properties exist
			assertPropertiesExist(t, panel, tt.expected)
		})
	}
}

// TestCleanupPanelForSave tests the core panel cleanup logic for save model
func TestTransformationsArrayContextAwareLogic(t *testing.T) {
	tests := []struct {
		name        string
		input       map[string]interface{}
		isNested    bool
		hasOriginal bool
		expected    map[string]interface{}
	}{
		{
			name: "top_level_panel_removes_empty_transformations",
			input: map[string]interface{}{
				"type":            "timeseries",
				"title":           "Top-level Panel",
				"transformations": []interface{}{},
			},
			isNested:    false,
			hasOriginal: true, // Had transformations in original input
			expected: map[string]interface{}{
				"type":  "timeseries",
				"title": "Top-level Panel",
				// transformations removed for top-level panels
			},
		},
		{
			name: "nested_panel_preserves_empty_transformations",
			input: map[string]interface{}{
				"type":            "timeseries",
				"title":           "Nested Panel",
				"transformations": []interface{}{},
			},
			isNested:    true,
			hasOriginal: true, // Had transformations in original input
			expected: map[string]interface{}{
				"type":            "timeseries",
				"title":           "Nested Panel",
				"transformations": []interface{}{}, // preserved for nested panels
			},
		},
		{
			name: "nested_panel_removes_added_transformations",
			input: map[string]interface{}{
				"type":            "table",
				"title":           "Nested Panel Without Original",
				"transformations": []interface{}{},
			},
			isNested:    true,
			hasOriginal: false, // Did NOT have transformations in original input
			expected: map[string]interface{}{
				"type":  "table",
				"title": "Nested Panel Without Original",
				// transformations removed - wasn't in original input
			},
		},
		{
			name: "preserve_non_empty_transformations",
			input: map[string]interface{}{
				"type":  "timeseries",
				"title": "Panel with actual transformations",
				"transformations": []interface{}{
					map[string]interface{}{
						"id": "reduce",
						"options": map[string]interface{}{
							"reducers": []interface{}{"mean"},
						},
					},
				},
			},
			isNested:    false,
			hasOriginal: true,
			expected: map[string]interface{}{
				"type":  "timeseries",
				"title": "Panel with actual transformations",
				"transformations": []interface{}{
					map[string]interface{}{
						"id": "reduce",
						"options": map[string]interface{}{
							"reducers": []interface{}{"mean"},
						},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a copy of input for testing
			panel := make(map[string]interface{})
			for k, v := range tt.input {
				panel[k] = v
			}

			// Set the original transformations marker if needed
			if tt.hasOriginal {
				panel["_originallyHadTransformations"] = true
			}

			// Apply the cleanup logic
			cleanupPanelForSaveWithContext(panel, tt.isNested)

			// Verify the result
			if !compareValues(panel, tt.expected) {
				t.Errorf("Test %s failed.\nExpected: %+v\nGot: %+v", tt.name, tt.expected, panel)
			}
		})
	}
}

func TestTrackOriginalTransformations(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "track_top_level_panel_with_transformations",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":              1,
						"type":            "timeseries",
						"title":           "Panel with transformations",
						"transformations": []interface{}{},
					},
					map[string]interface{}{
						"id":    2,
						"type":  "table",
						"title": "Panel without transformations",
					},
				},
			},
			expected: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":                            1,
						"type":                          "timeseries",
						"title":                         "Panel with transformations",
						"transformations":               []interface{}{},
						"_originallyHadTransformations": true, // marker added
					},
					map[string]interface{}{
						"id":    2,
						"type":  "table",
						"title": "Panel without transformations",
						// no marker added
					},
				},
			},
		},
		{
			name: "track_nested_panels_in_row",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "row",
						"title": "Row Panel",
						"panels": []interface{}{
							map[string]interface{}{
								"id":              10,
								"type":            "timeseries",
								"title":           "Nested Panel with transformations",
								"transformations": []interface{}{},
							},
							map[string]interface{}{
								"id":    11,
								"type":  "table",
								"title": "Nested Panel without transformations",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"type":  "row",
						"title": "Row Panel",
						"panels": []interface{}{
							map[string]interface{}{
								"id":                            10,
								"type":                          "timeseries",
								"title":                         "Nested Panel with transformations",
								"transformations":               []interface{}{},
								"_originallyHadTransformations": true, // marker added to nested panel
							},
							map[string]interface{}{
								"id":    11,
								"type":  "table",
								"title": "Nested Panel without transformations",
								// no marker added
							},
						},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a deep copy of input for testing
			dashboard := deepCopy(tt.input).(map[string]interface{})

			// Apply the tracking logic
			trackOriginalTransformations(dashboard)

			// Verify the result
			if !compareValues(dashboard, tt.expected) {
				t.Errorf("Test %s failed.\nExpected: %+v\nGot: %+v", tt.name, tt.expected, dashboard)
			}
		})
	}
}

func TestCleanupPanelForSave(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "remove_not_persisted_properties",
			input: map[string]interface{}{
				"type":                "timeseries",
				"title":               "Test Panel",
				"events":              map[string]interface{}{},
				"isViewing":           true,
				"cachedPluginOptions": map[string]interface{}{"test": "value"},
				"scopedVars":          map[string]interface{}{"var1": "value1"},
			},
			expected: map[string]interface{}{
				"type":  "timeseries",
				"title": "Test Panel",
				// events, isViewing, cachedPluginOptions, scopedVars should be removed
			},
		},
		{
			name: "remove_default_values",
			input: map[string]interface{}{
				"type":        "table",
				"title":       "",                       // Default value
				"transparent": false,                    // Default value
				"options":     map[string]interface{}{}, // Default value
				"links":       []interface{}{},          // Default value
			},
			expected: map[string]interface{}{
				"type": "table",
				// title, transparent, options, links should be removed as they match defaults
			},
		},
		{
			name: "preserve_non_default_values",
			input: map[string]interface{}{
				"type":        "timeseries",                              // Use timeseries to avoid auto-migration
				"title":       "Custom Title",                            // Non-default
				"transparent": true,                                      // Non-default
				"options":     map[string]interface{}{"custom": "value"}, // Non-default
			},
			expected: map[string]interface{}{
				"type":        "timeseries",
				"title":       "Custom Title",
				"transparent": true,
				"options":     map[string]interface{}{"custom": "value"},
			},
		},
		{
			name: "remove_empty_transformations_array_top_level",
			input: map[string]interface{}{
				"type":            "timeseries",
				"title":           "Test Panel",
				"transformations": []interface{}{}, // Empty array should be removed for top-level panels
			},
			expected: map[string]interface{}{
				"type":  "timeseries",
				"title": "Test Panel",
				// transformations should be removed for top-level panels
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			panel := make(map[string]interface{})
			for k, v := range tt.input {
				panel[k] = v
			}

			cleanupPanelForSaveWithContext(panel, false)

			// Verify expected properties exist
			assertPropertiesExist(t, panel, tt.expected)

			// Verify unwanted properties are removed
			unwantedProps := []string{"events", "isViewing", "cachedPluginOptions", "scopedVars"}
			assertPropertiesRemoved(t, panel, unwantedProps)
		})
	}
}

// TestApplyPanelAutoMigration tests the core panel auto-migration logic
func TestApplyPanelAutoMigration(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "migrate_graph_to_timeseries",
			input: map[string]interface{}{
				"type": "graph",
			},
			expected: map[string]interface{}{
				"type":            "timeseries",
				"autoMigrateFrom": "graph",
			},
		},
		{
			name: "migrate_graph_to_barchart",
			input: map[string]interface{}{
				"type": "graph",
				"xaxis": map[string]interface{}{
					"mode": "series",
				},
			},
			expected: map[string]interface{}{
				"type":            "barchart",
				"autoMigrateFrom": "graph",
			},
		},
		{
			name: "migrate_graph_to_bargauge",
			input: map[string]interface{}{
				"type": "graph",
				"xaxis": map[string]interface{}{
					"mode": "series",
				},
				"legend": map[string]interface{}{
					"values": true,
				},
			},
			expected: map[string]interface{}{
				"type":            "bargauge",
				"autoMigrateFrom": "graph",
			},
		},
		{
			name: "migrate_singlestat_to_stat",
			input: map[string]interface{}{
				"type": "singlestat",
			},
			expected: map[string]interface{}{
				"type":            "stat",
				"autoMigrateFrom": "singlestat",
			},
		},
		{
			name: "migrate_table_old_to_table",
			input: map[string]interface{}{
				"type": "table-old",
			},
			expected: map[string]interface{}{
				"type":            "table",
				"autoMigrateFrom": "table-old",
			},
		},
		{
			name: "no_migration_for_modern_panels",
			input: map[string]interface{}{
				"type": "timeseries",
			},
			expected: map[string]interface{}{
				"type": "timeseries",
				// No autoMigrateFrom should be added
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			panel := make(map[string]interface{})
			for k, v := range tt.input {
				panel[k] = v
			}

			applyPanelAutoMigration(panel)

			// Verify expected properties exist
			assertPropertiesExist(t, panel, tt.expected)

			// Verify no unexpected autoMigrateFrom is added
			if _, hasAutoMigrate := tt.expected["autoMigrateFrom"]; !hasAutoMigrate {
				if _, exists := panel["autoMigrateFrom"]; exists {
					t.Errorf("autoMigrateFrom should not be added for this panel type")
				}
			}
		})
	}
}

// TestRemoveNullValuesRecursively tests the core null value removal logic
func TestRemoveNullValuesRecursively(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected interface{}
	}{
		{
			name: "remove_null_values_from_map",
			input: map[string]interface{}{
				"title": "Test",
				"id":    nil,
				"config": map[string]interface{}{
					"enabled": true,
					"value":   nil,
				},
			},
			expected: map[string]interface{}{
				"title": "Test",
				"config": map[string]interface{}{
					"enabled": true,
				},
			},
		},
		{
			name: "process_array_elements",
			input: []interface{}{
				"item1",
				nil,
				"item2",
				map[string]interface{}{
					"key":  "value",
					"null": nil,
				},
			},
			expected: []interface{}{
				"item1",
				nil, // Null values in arrays are NOT removed by the current implementation
				"item2",
				map[string]interface{}{
					"key": "value",
					// null key should be removed from nested map
				},
			},
		},
		{
			name: "preserve_non_null_values",
			input: map[string]interface{}{
				"string": "value",
				"number": 42,
				"bool":   true,
				"array":  []interface{}{1, 2, 3},
			},
			expected: map[string]interface{}{
				"string": "value",
				"number": 42,
				"bool":   true,
				"array":  []interface{}{1, 2, 3},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a copy of the input to avoid modifying the original
			data := deepCopy(tt.input)

			removeNullValuesRecursively(data)

			if !compareValues(data, tt.expected) {
				t.Errorf("Null value removal failed. Expected: %v, Got: %v", tt.expected, data)
			}
		})
	}
}

// TestIsEqual tests the core value equality comparison logic
func TestIsEqual(t *testing.T) {
	tests := []struct {
		name     string
		a        interface{}
		b        interface{}
		expected bool
	}{
		{
			name:     "equal_strings",
			a:        "test",
			b:        "test",
			expected: true,
		},
		{
			name:     "different_strings",
			a:        "test1",
			b:        "test2",
			expected: false,
		},
		{
			name:     "equal_numbers",
			a:        float64(42),
			b:        float64(42),
			expected: true,
		},
		{
			name:     "equal_booleans",
			a:        true,
			b:        true,
			expected: true,
		},
		{
			name:     "equal_arrays",
			a:        []interface{}{float64(1), float64(2), float64(3)},
			b:        []interface{}{float64(1), float64(2), float64(3)},
			expected: true,
		},
		{
			name:     "different_arrays",
			a:        []interface{}{float64(1), float64(2), float64(3)},
			b:        []interface{}{float64(1), float64(2), float64(4)},
			expected: false,
		},
		{
			name:     "equal_maps",
			a:        map[string]interface{}{"key": "value"},
			b:        map[string]interface{}{"key": "value"},
			expected: true,
		},
		{
			name:     "different_maps",
			a:        map[string]interface{}{"key": "value1"},
			b:        map[string]interface{}{"key": "value2"},
			expected: false,
		},
		{
			name:     "nil_values",
			a:        nil,
			b:        nil,
			expected: true,
		},
		{
			name:     "nil_and_value",
			a:        nil,
			b:        "test",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isEqual(tt.a, tt.b)
			if result != tt.expected {
				t.Errorf("isEqual(%v, %v) = %v, expected %v", tt.a, tt.b, result, tt.expected)
			}
		})
	}
}

// Helper function to compare values recursively
func compareValues(actual, expected interface{}) bool {
	if actual == nil && expected == nil {
		return true
	}
	if actual == nil || expected == nil {
		return false
	}

	actualMap, actualOk := actual.(map[string]interface{})
	expectedMap, expectedOk := expected.(map[string]interface{})

	if actualOk && expectedOk {
		if len(actualMap) != len(expectedMap) {
			return false
		}
		for key, expectedValue := range expectedMap {
			actualValue, exists := actualMap[key]
			if !exists || !compareValues(actualValue, expectedValue) {
				return false
			}
		}
		return true
	}

	actualSlice, actualSliceOk := actual.([]interface{})
	expectedSlice, expectedSliceOk := expected.([]interface{})

	if actualSliceOk && expectedSliceOk {
		if len(actualSlice) != len(expectedSlice) {
			return false
		}
		for i, expectedValue := range expectedSlice {
			if !compareValues(actualSlice[i], expectedValue) {
				return false
			}
		}
		return true
	}

	return actual == expected
}

// Helper function to deep copy interface{}
func deepCopy(src interface{}) interface{} {
	switch v := src.(type) {
	case map[string]interface{}:
		dst := make(map[string]interface{})
		for k, val := range v {
			dst[k] = deepCopy(val)
		}
		return dst
	case []interface{}:
		dst := make([]interface{}, len(v))
		for i, val := range v {
			dst[i] = deepCopy(val)
		}
		return dst
	default:
		return src
	}
}

func TestEnsureTemplatingExists(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "create_templating_when_missing",
			input: map[string]interface{}{
				"title": "Test Dashboard",
			},
			expected: map[string]interface{}{
				"title": "Test Dashboard",
				"templating": map[string]interface{}{
					"list": []interface{}{},
				},
			},
		},
		{
			name: "add_list_to_existing_templating",
			input: map[string]interface{}{
				"templating": map[string]interface{}{
					"enable": true,
				},
			},
			expected: map[string]interface{}{
				"templating": map[string]interface{}{
					"enable": true,
					"list":   []interface{}{},
				},
			},
		},
		{
			name: "preserve_existing_templating",
			input: map[string]interface{}{
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"name": "var1"},
					},
				},
			},
			expected: map[string]interface{}{
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"name": "var1"},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := copyMap(tt.input)

			ensureTemplatingExists(dashboard)

			// Verify expected properties exist
			assertPropertiesExist(t, dashboard, tt.expected)
		})
	}
}

func TestEnsureAnnotationsExist(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "create_annotations_when_missing",
			input: map[string]interface{}{
				"title": "Test Dashboard",
			},
			expected: map[string]interface{}{
				"title": "Test Dashboard",
				"annotations": map[string]interface{}{
					"list": []interface{}{},
				},
			},
		},
		{
			name: "add_list_to_existing_annotations",
			input: map[string]interface{}{
				"annotations": map[string]interface{}{
					"enable": true,
				},
			},
			expected: map[string]interface{}{
				"annotations": map[string]interface{}{
					"enable": true,
					"list":   []interface{}{},
				},
			},
		},
		{
			name: "preserve_existing_annotations",
			input: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"name": "annotation1"},
					},
				},
			},
			expected: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{"name": "annotation1"},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := copyMap(tt.input)

			ensureAnnotationsExist(dashboard)

			// Verify expected properties exist
			assertPropertiesExist(t, dashboard, tt.expected)
		})
	}
}

func TestEnsurePanelsHaveUniqueIds(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "assign_ids_to_panels_without_ids",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{"type": "timeseries"},
					map[string]interface{}{"type": "table"},
				},
			},
			expected: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{"type": "timeseries", "id": float64(1)},
					map[string]interface{}{"type": "table", "id": float64(2)},
				},
			},
		},
		{
			name: "fix_duplicate_ids",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{"type": "timeseries", "id": float64(1)},
					map[string]interface{}{"type": "table", "id": float64(1)}, // Duplicate
					map[string]interface{}{"type": "graph", "id": float64(2)},
				},
			},
			expected: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{"type": "timeseries", "id": float64(1)},
					map[string]interface{}{"type": "table", "id": float64(3)}, // Fixed duplicate
					map[string]interface{}{"type": "graph", "id": float64(2)},
				},
			},
		},
		{
			name: "preserve_valid_ids",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{"type": "timeseries", "id": float64(5)},
					map[string]interface{}{"type": "table", "id": float64(10)},
				},
			},
			expected: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{"type": "timeseries", "id": float64(5)},
					map[string]interface{}{"type": "table", "id": float64(10)},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := copyMap(tt.input)

			ensurePanelsHaveUniqueIds(dashboard)

			// Verify expected properties exist
			assertPropertiesExist(t, dashboard, tt.expected)
		})
	}
}

func TestEnsureQueryIds(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "assign_refIds_to_targets_without_refIds",
			input: map[string]interface{}{
				"targets": []interface{}{
					map[string]interface{}{"expr": "up"},
					map[string]interface{}{"expr": "rate(up[5m])"},
				},
			},
			expected: map[string]interface{}{
				"targets": []interface{}{
					map[string]interface{}{"expr": "up", "refId": "A"},
					map[string]interface{}{"expr": "rate(up[5m])", "refId": "B"},
				},
			},
		},
		{
			name: "preserve_existing_refIds",
			input: map[string]interface{}{
				"targets": []interface{}{
					map[string]interface{}{"expr": "up", "refId": "A"},
					map[string]interface{}{"expr": "rate(up[5m])", "refId": "B"},
				},
			},
			expected: map[string]interface{}{
				"targets": []interface{}{
					map[string]interface{}{"expr": "up", "refId": "A"},
					map[string]interface{}{"expr": "rate(up[5m])", "refId": "B"},
				},
			},
		},
		{
			name: "assign_refIds_to_mixed_targets",
			input: map[string]interface{}{
				"targets": []interface{}{
					map[string]interface{}{"expr": "up", "refId": "A"},
					map[string]interface{}{"expr": "rate(up[5m])"}, // Missing refId
					map[string]interface{}{"expr": "sum(up)", "refId": "C"},
				},
			},
			expected: map[string]interface{}{
				"targets": []interface{}{
					map[string]interface{}{"expr": "up", "refId": "A"},
					map[string]interface{}{"expr": "rate(up[5m])", "refId": "B"}, // Assigned
					map[string]interface{}{"expr": "sum(up)", "refId": "C"},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			panel := make(map[string]interface{})
			for k, v := range tt.input {
				panel[k] = v
			}

			ensureQueryIds(panel)

			// Verify expected properties exist
			assertPropertiesExist(t, panel, tt.expected)
		})
	}
}

func TestAddBuiltInAnnotationQuery(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "add_built_in_annotation_when_none_exists",
			input: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{},
				},
			},
			expected: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"datasource": map[string]interface{}{
								"uid":  "-- Grafana --",
								"type": "grafana",
							},
							"name":      "Annotations & Alerts",
							"type":      "dashboard",
							"iconColor": "rgba(0, 211, 255, 1)",
							"enable":    true,
							"hide":      true,
							"builtIn":   float64(1),
						},
					},
				},
			},
		},
		{
			name: "preserve_existing_built_in_annotation",
			input: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":    "Annotations & Alerts",
							"builtIn": float64(1),
						},
					},
				},
			},
			expected: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":    "Annotations & Alerts",
							"builtIn": float64(1),
						},
					},
				},
			},
		},
		{
			name: "add_built_in_annotation_with_existing_custom_annotations",
			input: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name": "Custom Annotation",
							"type": "tags",
						},
					},
				},
			},
			expected: map[string]interface{}{
				"annotations": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"datasource": map[string]interface{}{
								"uid":  "-- Grafana --",
								"type": "grafana",
							},
							"name":      "Annotations & Alerts",
							"type":      "dashboard",
							"iconColor": "rgba(0, 211, 255, 1)",
							"enable":    true,
							"hide":      true,
							"builtIn":   float64(1),
						},
						map[string]interface{}{
							"name": "Custom Annotation",
							"type": "tags",
						},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := copyMap(tt.input)

			addBuiltInAnnotationQuery(dashboard)

			// Verify expected properties exist
			assertPropertiesExist(t, dashboard, tt.expected)
		})
	}
}

func TestInitMeta(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]interface{}
		expected map[string]interface{}
	}{
		{
			name: "init_meta_with_defaults",
			input: map[string]interface{}{
				"editable": true,
			},
			expected: map[string]interface{}{
				"editable": true,
				"meta": map[string]interface{}{
					"canShare":               true,
					"canSave":                true,
					"canStar":                true,
					"canEdit":                true,
					"canDelete":              true,
					"showSettings":           true,
					"canMakeEditable":        false,
					"hasUnsavedFolderChange": false,
				},
			},
		},
		{
			name: "init_meta_for_non_editable_dashboard",
			input: map[string]interface{}{
				"editable": false,
			},
			expected: map[string]interface{}{
				"editable": false,
				"meta": map[string]interface{}{
					"canShare":               true,
					"canSave":                false, // Restricted for non-editable
					"canStar":                true,
					"canEdit":                false, // Restricted for non-editable
					"canDelete":              false, // Restricted for non-editable
					"showSettings":           true,  // Set before canEdit is restricted (current implementation behavior)
					"canMakeEditable":        true,  // Can make editable
					"hasUnsavedFolderChange": false,
				},
			},
		},
		{
			name: "preserve_existing_meta",
			input: map[string]interface{}{
				"editable": true,
				"meta": map[string]interface{}{
					"canShare": false, // Custom value
				},
			},
			expected: map[string]interface{}{
				"editable": true,
				"meta": map[string]interface{}{
					"canShare":               false, // Preserved
					"canSave":                true,
					"canStar":                true,
					"canEdit":                true,
					"canDelete":              true,
					"showSettings":           true,
					"canMakeEditable":        false,
					"hasUnsavedFolderChange": false,
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboard := copyMap(tt.input)

			initMeta(dashboard)

			// Verify expected properties exist
			assertPropertiesExist(t, dashboard, tt.expected)
		})
	}
}
