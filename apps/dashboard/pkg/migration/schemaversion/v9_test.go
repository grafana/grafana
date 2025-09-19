package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV9(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "singlestat panel with thresholds having 3 or more values should have first threshold removed",
			input: map[string]interface{}{
				"title":         "V9 Singlestat Thresholds Migration Test Dashboard",
				"schemaVersion": 8,
				"panels": []interface{}{
					map[string]interface{}{
						"type":       "singlestat",
						"id":         1,
						"thresholds": "10,20,30",
					},
					map[string]interface{}{
						"type":       "singlestat",
						"id":         2,
						"thresholds": "100,200,300,400",
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V9 Singlestat Thresholds Migration Test Dashboard",
				"schemaVersion": 9,
				"panels": []interface{}{
					map[string]interface{}{
						"type":       "singlestat",
						"id":         1,
						"thresholds": "20,30",
					},
					map[string]interface{}{
						"type":       "singlestat",
						"id":         2,
						"thresholds": "200,300,400",
					},
				},
			},
		},
		{
			name: "singlestat panel with thresholds having less than 3 values should remain unchanged",
			input: map[string]interface{}{
				"title":         "V9 Singlestat Thresholds No Change Test Dashboard",
				"schemaVersion": 8,
				"panels": []interface{}{
					map[string]interface{}{
						"type":       "singlestat",
						"id":         1,
						"thresholds": "10,20",
					},
					map[string]interface{}{
						"type":       "singlestat",
						"id":         2,
						"thresholds": "100",
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V9 Singlestat Thresholds No Change Test Dashboard",
				"schemaVersion": 9,
				"panels": []interface{}{
					map[string]interface{}{
						"type":       "singlestat",
						"id":         1,
						"thresholds": "10,20",
					},
					map[string]interface{}{
						"type":       "singlestat",
						"id":         2,
						"thresholds": "100",
					},
				},
			},
		},
		{
			name: "non-singlestat panels should remain unchanged",
			input: map[string]interface{}{
				"title":         "V9 Non-Singlestat Panel Test Dashboard",
				"schemaVersion": 8,
				"panels": []interface{}{
					map[string]interface{}{
						"type":       "graph",
						"id":         1,
						"thresholds": "10,20,30",
					},
					map[string]interface{}{
						"type":       "table",
						"id":         2,
						"thresholds": "100,200,300",
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V9 Non-Singlestat Panel Test Dashboard",
				"schemaVersion": 9,
				"panels": []interface{}{
					map[string]interface{}{
						"type":       "graph",
						"id":         1,
						"thresholds": "10,20,30",
					},
					map[string]interface{}{
						"type":       "table",
						"id":         2,
						"thresholds": "100,200,300",
					},
				},
			},
		},
		{
			name: "singlestat panel without thresholds should remain unchanged",
			input: map[string]interface{}{
				"title":         "V9 Singlestat No Thresholds Test Dashboard",
				"schemaVersion": 8,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "singlestat",
						"id":   1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V9 Singlestat No Thresholds Test Dashboard",
				"schemaVersion": 9,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "singlestat",
						"id":   1,
					},
				},
			},
		},
		{
			name: "singlestat panel with empty thresholds should remain unchanged",
			input: map[string]interface{}{
				"title":         "V9 Singlestat Empty Thresholds Test Dashboard",
				"schemaVersion": 8,
				"panels": []interface{}{
					map[string]interface{}{
						"type":       "singlestat",
						"id":         1,
						"thresholds": "",
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V9 Singlestat Empty Thresholds Test Dashboard",
				"schemaVersion": 9,
				"panels": []interface{}{
					map[string]interface{}{
						"type":       "singlestat",
						"id":         1,
						"thresholds": "",
					},
				},
			},
		},
		{
			name: "dashboard without panels should only update schema version",
			input: map[string]interface{}{
				"title":         "V9 No Panels Test Dashboard",
				"schemaVersion": 8,
			},
			expected: map[string]interface{}{
				"title":         "V9 No Panels Test Dashboard",
				"schemaVersion": 9,
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V9)
}
