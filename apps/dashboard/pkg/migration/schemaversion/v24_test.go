package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/testutil"
)

func TestV24(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "should migrate Angular table to table",
			input: map[string]interface{}{
				"schemaVersion": 23,
				"panels": []interface{}{
					map[string]interface{}{
						"id":     1,
						"type":   "table",
						"legend": true,
						"styles": []interface{}{
							map[string]interface{}{
								"thresholds": []interface{}{"10", "20", "30"},
								"colors":     []interface{}{"red", "yellow", "green"},
								"pattern":    "/.*/",
							},
						},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
					},
				},
			},
			expected: map[string]interface{}{
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"id":     1,
						"type":   "table",
						"legend": true,
						"fieldConfig": map[string]interface{}{
							"defaults": map[string]interface{}{
								"custom": map[string]interface{}{},
								"thresholds": map[string]interface{}{
									"mode": "absolute",
									"steps": []interface{}{
										map[string]interface{}{"value": nil, "color": "red"},
										map[string]interface{}{"value": float64(10), "color": "red"},
										map[string]interface{}{"value": float64(20), "color": "yellow"},
										map[string]interface{}{"value": float64(30), "color": "green"},
									},
								},
							},
							"overrides": []interface{}{},
						},
						"transformations": []interface{}{},
						"targets": []interface{}{
							map[string]interface{}{"refId": "A"},
						},
						"pluginVersion": "1.0.0",
					},
				},
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V24(testutil.GetTestPanelProvider()))
}
