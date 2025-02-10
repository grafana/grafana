package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"
)

func TestV39(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "no transformations",
			input: map[string]interface{}{
				"schemaVersion": 38,
				"title":         "Test Dashboard",
				"panels": []interface{}{
					map[string]interface{}{
						"title": "Panel 1",
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": 39,
				"panels": []interface{}{
					map[string]interface{}{
						"title": "Panel 1",
					},
				},
			},
		},
		{
			name: "timeSeriesTable transformation with refIdToStat",
			input: map[string]interface{}{
				"schemaVersion": 38,
				"panels": []interface{}{
					map[string]interface{}{
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "timeSeriesTable",
								"options": map[string]interface{}{
									"refIdToStat": map[string]interface{}{
										"A": "mean",
										"B": "max",
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 39,
				"panels": []interface{}{
					map[string]interface{}{
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "timeSeriesTable",
								"options": map[string]interface{}{
									"A": map[string]interface{}{
										"stat": "mean",
									},
									"B": map[string]interface{}{
										"stat": "max",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "non-timeSeriesTable transformation is not modified",
			input: map[string]interface{}{
				"panels": []interface{}{
					map[string]interface{}{
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "otherTransform",
								"options": map[string]interface{}{
									"refIdToStat": map[string]interface{}{
										"A": "mean",
									},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 39,
				"panels": []interface{}{
					map[string]interface{}{
						"transformations": []interface{}{
							map[string]interface{}{
								"id": "otherTransform",
								"options": map[string]interface{}{
									"refIdToStat": map[string]interface{}{
										"A": "mean",
									},
								},
							},
						},
					},
				},
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V39)
}
