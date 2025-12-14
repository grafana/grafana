package store

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/stretchr/testify/require"
)

func TestBuildGlobPattern(t *testing.T) {
	sqliteDialect := migrator.NewSQLite3Dialect()

	tests := []struct {
		name     string
		key      string
		value    string
		expected string
	}{
		{
			name:     "simple key-value",
			key:      "team",
			value:    "alerting",
			expected: `"team":"alerting"`,
		},
		{
			name:     "empty value",
			key:      "empty",
			value:    "",
			expected: `"empty":""`,
		},
		{
			name:     "special GLOB chars are escaped",
			key:      "key",
			value:    "*[?]",
			expected: `"key":"[*][[][?]]"`,
		},
		{
			name:     "special chars are escaped",
			key:      "key",
			value:    "line1\nline2\\end\"quote",
			expected: `"key":"line1\nline2\\end\"quote"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pattern, err := buildGlobPattern(sqliteDialect, tt.key, tt.value)
			require.NoError(t, err)
			require.Equal(t, tt.expected, pattern)
		})
	}

	t.Run("PostgreSQL returns error", func(t *testing.T) {
		_, err := buildGlobPattern(migrator.NewPostgresDialect(), "key", "value")
		require.ErrorIs(t, err, errGlobNotSupported)
	})

	t.Run("MySQL returns error", func(t *testing.T) {
		_, err := buildGlobPattern(migrator.NewMysqlDialect(), "key", "value")
		require.ErrorIs(t, err, errGlobNotSupported)
	})
}

func TestJsonExtractText(t *testing.T) {
	tests := []struct {
		name          string
		dialect       migrator.Dialect
		column        string
		expected      string
		expectedError error
	}{
		{
			name:     "MySQL",
			dialect:  migrator.NewMysqlDialect(),
			column:   "labels",
			expected: `JSON_UNQUOTE(JSON_EXTRACT(labels, CONCAT('$.', ?)))`,
		},
		{
			name:     "PostgreSQL",
			dialect:  migrator.NewPostgresDialect(),
			column:   "labels",
			expected: `jsonb_extract_path_text(labels::jsonb, ?)`,
		},
		{
			name:          "SQLite returns error",
			dialect:       migrator.NewSQLite3Dialect(),
			column:        "labels",
			expectedError: errJSONNotSupported,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sql, err := jsonExtractText(tt.dialect, tt.column)

			if tt.expectedError != nil {
				require.ErrorIs(t, err, tt.expectedError)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.expected, sql)
			}
		})
	}
}
