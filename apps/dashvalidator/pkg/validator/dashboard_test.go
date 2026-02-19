package validator

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsV1Dashboard(t *testing.T) {
	tests := []struct {
		name      string
		dashboard map[string]interface{}
		expected  bool
	}{
		{
			name: "v1 dashboard with panels array",
			dashboard: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "Panel 1",
						"type":  "timeseries",
					},
				},
			},
			expected: true,
		},
		{
			name: "v1 dashboard with empty panels",
			dashboard: map[string]interface{}{
				"panels": []interface{}{},
			},
			expected: true,
		},
		{
			name: "v2 dashboard with elements map",
			dashboard: map[string]interface{}{
				"elements": map[string]interface{}{
					"panel-1": map[string]interface{}{
						"kind": "Panel",
						"spec": map[string]interface{}{
							"id":    1,
							"title": "Panel 1",
						},
					},
				},
			},
			expected: false,
		},
		{
			name: "v2 dashboard with layout",
			dashboard: map[string]interface{}{
				"layout": map[string]interface{}{
					"kind": "GridLayout",
					"spec": map[string]interface{}{
						"items": []interface{}{},
					},
				},
			},
			expected: false,
		},
		{
			name: "v2 dashboard with both elements and layout",
			dashboard: map[string]interface{}{
				"elements": map[string]interface{}{
					"panel-1": map[string]interface{}{
						"kind": "Panel",
					},
				},
				"layout": map[string]interface{}{
					"kind": "GridLayout",
				},
			},
			expected: false,
		},
		{
			name:      "empty dashboard",
			dashboard: map[string]interface{}{},
			expected:  false,
		},
		{
			name: "dashboard with wrong panels type (string instead of array)",
			dashboard: map[string]interface{}{
				"panels": "this-should-be-array-not-string",
			},
			expected: false,
		},
		{
			name: "dashboard with other fields only",
			dashboard: map[string]interface{}{
				"title": "Test Dashboard",
				"uid":   "test-uid",
				"tags":  []string{"monitoring"},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isV1Dashboard(tt.dashboard)
			require.Equal(t, tt.expected, result, "isV1Dashboard() returned unexpected result")
		})
	}
}

func TestDatasourceValidationResult_JSONSerialization(t *testing.T) {
	// Verify that embedded struct produces the expected flat JSON structure
	result := DatasourceValidationResult{
		ValidationResult: ValidationResult{
			TotalQueries:   10,
			CheckedQueries: 10,
			QueryBreakdown: []QueryResult{},
			CompatibilityResult: CompatibilityResult{
				TotalMetrics:       5,
				FoundMetrics:       4,
				MissingMetrics:     []string{"missing_metric"},
				CompatibilityScore: 0.8,
			},
		},
		UID:  "test-uid",
		Type: "prometheus",
		Name: "Test Datasource",
	}

	jsonBytes, err := json.Marshal(result)
	require.NoError(t, err)

	var parsed map[string]interface{}
	err = json.Unmarshal(jsonBytes, &parsed)
	require.NoError(t, err)

	// Verify all fields are at top level (not nested)
	require.Equal(t, "test-uid", parsed["uid"])
	require.Equal(t, "prometheus", parsed["type"])
	require.Equal(t, "Test Datasource", parsed["name"])
	require.Equal(t, float64(10), parsed["totalQueries"])
	require.Equal(t, float64(10), parsed["checkedQueries"])
	require.Equal(t, float64(5), parsed["totalMetrics"])
	require.Equal(t, float64(4), parsed["foundMetrics"])
	require.Equal(t, float64(0.8), parsed["compatibilityScore"])

	// Verify no nested "ValidationResult" key exists
	_, hasNestedKey := parsed["ValidationResult"]
	require.False(t, hasNestedKey, "ValidationResult should not be a nested key in JSON")
}

func TestExtractQueriesFromDashboard_VersionValidation(t *testing.T) {
	tests := []struct {
		name          string
		dashboard     map[string]interface{}
		expectError   bool
		errorContains string
	}{
		{
			name: "valid v1 dashboard extracts queries successfully",
			dashboard: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "CPU Usage",
						"type":  "timeseries",
						"gridPos": map[string]interface{}{
							"h": 8,
							"w": 12,
							"x": 0,
							"y": 0,
						},
						"targets": []interface{}{
							map[string]interface{}{
								"datasource": map[string]interface{}{
									"type": "prometheus",
									"uid":  "test-prometheus",
								},
								"expr":  "rate(cpu_usage_total[5m])",
								"refId": "A",
							},
						},
					},
				},
			},
			expectError: false,
		},
		{
			name: "v2 dashboard returns unsupported format error",
			dashboard: map[string]interface{}{
				"elements": map[string]interface{}{
					"panel-1": map[string]interface{}{
						"kind": "Panel",
						"spec": map[string]interface{}{
							"id":    1,
							"title": "Panel 1",
							"data": map[string]interface{}{
								"kind": "QueryGroup",
							},
							"vizConfig": map[string]interface{}{
								"kind":     "TimeSeriesVisualConfig",
								"pluginId": "timeseries",
							},
						},
					},
				},
				"layout": map[string]interface{}{
					"kind": "GridLayout",
					"spec": map[string]interface{}{
						"items": []interface{}{},
					},
				},
			},
			expectError:   true,
			errorContains: "unsupported dashboard format",
		},
		{
			name: "invalid dashboard (no panels or elements) returns error",
			dashboard: map[string]interface{}{
				"title":       "Invalid Dashboard",
				"description": "This dashboard has no panels or elements",
				"tags":        []string{"test"},
			},
			expectError:   true,
			errorContains: "unsupported dashboard format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			queries, err := extractQueriesFromDashboard(tt.dashboard)

			if tt.expectError {
				require.Error(t, err, "Expected error but got none")
				require.Contains(t, err.Error(), tt.errorContains, "Error message doesn't contain expected substring")
			} else {
				require.NoError(t, err, "Expected no error but got: %v", err)
				require.NotNil(t, queries, "Queries should not be nil for valid dashboard")
			}
		})
	}
}
