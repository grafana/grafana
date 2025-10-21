package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV25(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "v25 no-op migration, updates schema version only",
			input: map[string]interface{}{
				"title":         "V25 No-Op Migration Test Dashboard",
				"schemaVersion": 24,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel remains unchanged",
						"id":    1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V25 No-Op Migration Test Dashboard",
				"schemaVersion": 25,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "timeseries",
						"title": "Panel remains unchanged",
						"id":    1,
					},
				},
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V25)
}
