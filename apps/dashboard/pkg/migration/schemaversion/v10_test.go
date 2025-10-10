package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV10(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "table panel with thresholds having 3 or more values should have first threshold removed",
			input: map[string]interface{}{
				"title":         "V10 Table Thresholds Migration Test Dashboard",
				"schemaVersion": 9,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"id":   1,
						"styles": []interface{}{
							map[string]interface{}{
								"thresholds": []interface{}{"10", "20", "30"},
							},
							map[string]interface{}{
								"thresholds": []interface{}{"100", "200", "300"},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V10 Table Thresholds Migration Test Dashboard",
				"schemaVersion": 10,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"id":   1,
						"styles": []interface{}{
							map[string]interface{}{
								"thresholds": []interface{}{"20", "30"},
							},
							map[string]interface{}{
								"thresholds": []interface{}{"200", "300"},
							},
						},
					},
				},
			},
		},
		{
			name: "table panel with thresholds having less than 3 values should remain unchanged",
			input: map[string]interface{}{
				"title":         "V10 Table Thresholds No Change Test Dashboard",
				"schemaVersion": 9,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"id":   1,
						"styles": []interface{}{
							map[string]interface{}{
								"thresholds": []interface{}{"10", "20"},
							},
							map[string]interface{}{
								"thresholds": []interface{}{"100"},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V10 Table Thresholds No Change Test Dashboard",
				"schemaVersion": 10,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"id":   1,
						"styles": []interface{}{
							map[string]interface{}{
								"thresholds": []interface{}{"10", "20"},
							},
							map[string]interface{}{
								"thresholds": []interface{}{"100"},
							},
						},
					},
				},
			},
		},
		{
			name: "non-table panels should remain unchanged",
			input: map[string]interface{}{
				"title":         "V10 Non-Table Panel Test Dashboard",
				"schemaVersion": 9,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "graph",
						"id":   1,
						"styles": []interface{}{
							map[string]interface{}{
								"thresholds": []interface{}{"10", "20", "30"},
							},
						},
					},
					map[string]interface{}{
						"type": "singlestat",
						"id":   2,
						"styles": []interface{}{
							map[string]interface{}{
								"thresholds": []interface{}{"100", "200", "300"},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V10 Non-Table Panel Test Dashboard",
				"schemaVersion": 10,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "graph",
						"id":   1,
						"styles": []interface{}{
							map[string]interface{}{
								"thresholds": []interface{}{"10", "20", "30"},
							},
						},
					},
					map[string]interface{}{
						"type": "singlestat",
						"id":   2,
						"styles": []interface{}{
							map[string]interface{}{
								"thresholds": []interface{}{"100", "200", "300"},
							},
						},
					},
				},
			},
		},
		{
			name: "table panel without styles should remain unchanged",
			input: map[string]interface{}{
				"title":         "V10 Table No Styles Test Dashboard",
				"schemaVersion": 9,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"id":   1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V10 Table No Styles Test Dashboard",
				"schemaVersion": 10,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"id":   1,
					},
				},
			},
		},
		{
			name: "table panel with styles but no thresholds should remain unchanged",
			input: map[string]interface{}{
				"title":         "V10 Table No Thresholds Test Dashboard",
				"schemaVersion": 9,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"id":   1,
						"styles": []interface{}{
							map[string]interface{}{
								"colorMode": "cell",
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V10 Table No Thresholds Test Dashboard",
				"schemaVersion": 10,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "table",
						"id":   1,
						"styles": []interface{}{
							map[string]interface{}{
								"colorMode": "cell",
							},
						},
					},
				},
			},
		},
		{
			name: "dashboard without panels should only update schema version",
			input: map[string]interface{}{
				"title":         "V10 No Panels Test Dashboard",
				"schemaVersion": 9,
			},
			expected: map[string]interface{}{
				"title":         "V10 No Panels Test Dashboard",
				"schemaVersion": 10,
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V10)
}
