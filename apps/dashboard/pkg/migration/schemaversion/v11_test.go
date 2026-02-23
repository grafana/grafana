package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestV11(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "v11 no-op migration, updates schema version only",
			input: map[string]interface{}{
				"title":         "V11 No-Op Migration Test Dashboard",
				"schemaVersion": 10,
				"panels": []interface{}{
					map[string]interface{}{
						"type":  "graph",
						"title": "Panel remains unchanged",
						"id":    1,
					},
				},
			},
			expected: map[string]interface{}{
				"title":         "V11 No-Op Migration Test Dashboard",
				"schemaVersion": 11,
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
	runMigrationTests(t, tests, schemaversion.V11)
}
