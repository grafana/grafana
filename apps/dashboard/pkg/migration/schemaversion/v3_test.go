package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV3(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "v3 no-op migration, updates schema version only",
			input: map[string]interface{}{
				"title":         "V3 No-Op Migration Test Dashboard",
				"schemaVersion": 2,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel remains unchanged",
						"id":    1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V3 No-Op Migration Test Dashboard",
				"schemaVersion": 3,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel remains unchanged",
						"id":    1,
					},
				},
			},
		},
	}
	runMigrationTests(t, tests, schemaversion.V3)
}
