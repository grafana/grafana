package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV7Migration(t *testing.T) {
	testCases := []migrationTestCase{
		{
			name: "nav to timepicker conversion with query refId assignment",
			input: map[string]interface{}{
				"schemaVersion": 6,
				"nav": []interface{}{
					map[string]interface{}{
						"enable":            true,
						"type":              "timepicker",
						"status":            "Stable",
						"time_options":      []interface{}{"5m", "15m", "1h", "6h", "12h", "24h", "2d", "7d", "30d"},
						"refresh_intervals": []interface{}{"5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"},
						"now":               true,
						"collapse":          false,
						"notice":            false,
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"targets": []interface{}{
							map[string]interface{}{"expr": "up"},
							map[string]interface{}{"expr": "cpu_usage", "refId": "B"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 7,
				"nav": []interface{}{
					map[string]interface{}{
						"enable":            true,
						"type":              "timepicker",
						"status":            "Stable",
						"time_options":      []interface{}{"5m", "15m", "1h", "6h", "12h", "24h", "2d", "7d", "30d"},
						"refresh_intervals": []interface{}{"5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"},
						"now":               true,
						"collapse":          false,
						"notice":            false,
					},
				},
				"timepicker": map[string]interface{}{
					"enable":            true,
					"type":              "timepicker",
					"status":            "Stable",
					"time_options":      []interface{}{"5m", "15m", "1h", "6h", "12h", "24h", "2d", "7d", "30d"},
					"refresh_intervals": []interface{}{"5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"},
					"now":               true,
					"collapse":          false,
					"notice":            false,
				},
				"panels": []interface{}{
					map[string]interface{}{
						"targets": []interface{}{
							map[string]interface{}{"expr": "up"},
							map[string]interface{}{"expr": "cpu_usage", "refId": "B"},
						},
					},
				},
			},
		},
		{
			name: "nav conversion without panels",
			input: map[string]interface{}{
				"schemaVersion": 6,
				"nav": []interface{}{
					map[string]interface{}{
						"enable": true,
						"type":   "timepicker",
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 7,
				"timepicker": map[string]interface{}{
					"enable": true,
					"type":   "timepicker",
				},
				"nav": []interface{}{
					map[string]interface{}{
						"enable": true,
						"type":   "timepicker",
					},
				},
			},
		},
		{
			name: "empty nav array",
			input: map[string]interface{}{
				"schemaVersion": 6,
				"nav":           []interface{}{},
			},
			expected: map[string]interface{}{
				"schemaVersion": 7,
				"nav":           []interface{}{},
			},
		},
		{
			name: "no nav property",
			input: map[string]interface{}{
				"schemaVersion": 6,
				"title":         "Test Dashboard",
			},
			expected: map[string]interface{}{
				"schemaVersion": 7,
				"title":         "Test Dashboard",
			},
		},
		{
			name: "panels with nested panels",
			input: map[string]interface{}{
				"schemaVersion": 6,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"targets": []interface{}{
									map[string]interface{}{"expr": "memory_usage"},
								},
							},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 7,
				"panels": []interface{}{
					map[string]interface{}{
						"type": "row",
						"panels": []interface{}{
							map[string]interface{}{
								"targets": []interface{}{
									map[string]interface{}{"expr": "memory_usage"},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "multiple nav items - only first is used",
			input: map[string]interface{}{
				"schemaVersion": 6,
				"nav": []interface{}{
					map[string]interface{}{
						"enable": true,
						"type":   "timepicker",
					},
					map[string]interface{}{
						"enable": false,
						"type":   "other",
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 7,
				"timepicker": map[string]interface{}{
					"enable": true,
					"type":   "timepicker",
				},
				"nav": []interface{}{
					map[string]interface{}{
						"enable": true,
						"type":   "timepicker",
					},
					map[string]interface{}{
						"enable": false,
						"type":   "other",
					},
				},
			},
		},
		{
			name: "invalid nav structure",
			input: map[string]interface{}{
				"schemaVersion": 6,
				"nav":           "invalid",
			},
			expected: map[string]interface{}{
				"schemaVersion": 7,
				"nav":           "invalid",
			},
		},
		{
			name: "panels with invalid structure",
			input: map[string]interface{}{
				"schemaVersion": 6,
				"panels":        "invalid",
			},
			expected: map[string]interface{}{
				"schemaVersion": 7,
				"panels":        "invalid",
			},
		},
	}

	runMigrationTests(t, testCases, schemaversion.V7)
}
