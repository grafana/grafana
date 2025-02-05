package schemaversion_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"
)

func TestV40(t *testing.T) {
	tests := []migrationTestCase{
		{
			name: "refresh not set",
			input: map[string]interface{}{
				"title": "Test Dashboard",
			},
			expected: map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": 40,
				"refresh":       "",
			},
		},
		{
			name: "boolean refresh value is converted to an empty string",
			input: map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": 39,
				"refresh":       true,
			},
			expected: map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": 40,
				"refresh":       "",
			},
		},
		{
			name: "string refresh value is not converted",
			input: map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": 39,
				"refresh":       "1m",
			},
			expected: map[string]interface{}{
				"title":         "Test Dashboard",
				"schemaVersion": 40,
				"refresh":       "1m",
			},
		},
	}

	runMigrationTests(t, tests, schemaversion.V40)
}
