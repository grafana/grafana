package schemaversion_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

func TestGetSchemaVersion(t *testing.T) {
	tests := []struct {
		name     string
		dash     map[string]interface{}
		expected int
	}{
		{
			name: "schemaVersion as int",
			dash: map[string]interface{}{
				"schemaVersion": 16,
			},
			expected: 16,
		},
		{
			name: "schemaVersion as float64",
			dash: map[string]interface{}{
				"schemaVersion": 40.2345,
			},
			expected: 40,
		},
		{
			name:     "schemaVersion is not set",
			dash:     map[string]interface{}{},
			expected: 0,
		},
		{
			name: "schemaVersion as string int",
			dash: map[string]interface{}{
				"schemaVersion": "5",
			},
			expected: 5,
		},
		{
			name: "schemaVersion as invalid string",
			dash: map[string]interface{}{
				"schemaVersion": "foo",
			},
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := schemaversion.GetSchemaVersion(tt.dash)
			require.Equal(t, tt.expected, result)
		})
	}
}

type migrationTestCase struct {
	name          string
	input         map[string]interface{}
	expected      map[string]interface{}
	expectedError string
}

func runMigrationTests(t *testing.T, testCases []migrationTestCase, migrationFunc schemaversion.SchemaVersionMigrationFunc) {
	t.Helper()

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			err := migrationFunc(context.Background(), tt.input)
			if tt.expectedError != "" {
				require.Error(t, err)
				require.Equal(t, tt.expectedError, err.Error())
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, tt.input)
			}
		})
	}
}
