package store

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/stretchr/testify/require"
)

func TestJsonEquals(t *testing.T) {
	tests := []struct {
		name     string
		dialect  migrator.Dialect
		column   string
		key      string
		value    string
		wantSQL  string
		wantArgs []any
	}{
		{
			name:     "MySQL",
			dialect:  migrator.NewMysqlDialect(),
			column:   "labels",
			key:      "team",
			value:    "alerting",
			wantSQL:  "JSON_UNQUOTE(JSON_EXTRACT(NULLIF(labels, ''), CONCAT('$.', ?))) = ?",
			wantArgs: []any{"team", "alerting"},
		},
		{
			name:     "PostgreSQL",
			dialect:  migrator.NewPostgresDialect(),
			column:   "labels",
			key:      "team",
			value:    "alerting",
			wantSQL:  "jsonb_extract_path_text(NULLIF(labels, '')::jsonb, ?) = ?",
			wantArgs: []any{"team", "alerting"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sql, args := jsonEquals(tt.dialect, tt.column, tt.key, tt.value)
			require.Equal(t, tt.wantSQL, sql)
			require.Equal(t, tt.wantArgs, args)
		})
	}
}

func TestJsonNotEquals(t *testing.T) {
	tests := []struct {
		name     string
		dialect  migrator.Dialect
		column   string
		key      string
		value    string
		wantSQL  string
		wantArgs []any
	}{
		{
			name:     "MySQL",
			dialect:  migrator.NewMysqlDialect(),
			column:   "labels",
			key:      "team",
			value:    "alerting",
			wantSQL:  "(JSON_UNQUOTE(JSON_EXTRACT(NULLIF(labels, ''), CONCAT('$.', ?))) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(NULLIF(labels, ''), CONCAT('$.', ?))) != ?)",
			wantArgs: []any{"team", "team", "alerting"},
		},
		{
			name:     "PostgreSQL",
			dialect:  migrator.NewPostgresDialect(),
			column:   "labels",
			key:      "team",
			value:    "alerting",
			wantSQL:  "(jsonb_extract_path_text(NULLIF(labels, '')::jsonb, ?) IS NULL OR jsonb_extract_path_text(NULLIF(labels, '')::jsonb, ?) != ?)",
			wantArgs: []any{"team", "team", "alerting"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sql, args := jsonNotEquals(tt.dialect, tt.column, tt.key, tt.value)
			require.Equal(t, tt.wantSQL, sql)
			require.Equal(t, tt.wantArgs, args)
		})
	}
}

func TestJsonKeyMissing(t *testing.T) {
	tests := []struct {
		name     string
		dialect  migrator.Dialect
		column   string
		key      string
		wantSQL  string
		wantArgs []any
	}{
		{
			name:     "MySQL",
			dialect:  migrator.NewMysqlDialect(),
			column:   "labels",
			key:      "team",
			wantSQL:  "JSON_EXTRACT(NULLIF(labels, ''), CONCAT('$.', ?)) IS NULL",
			wantArgs: []any{"team"},
		},
		{
			name:     "PostgreSQL",
			dialect:  migrator.NewPostgresDialect(),
			column:   "labels",
			key:      "team",
			wantSQL:  "jsonb_extract_path_text(NULLIF(labels, '')::jsonb, ?) IS NULL",
			wantArgs: []any{"team"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sql, args := jsonKeyMissing(tt.dialect, tt.column, tt.key)
			require.Equal(t, tt.wantSQL, sql)
			require.Equal(t, tt.wantArgs, args)
		})
	}
}

func TestGlobEquals(t *testing.T) {
	sql, args, err := globEquals("labels", "team", "alerting")
	require.NoError(t, err)
	require.Equal(t, "labels GLOB ?", sql)
	require.Equal(t, []any{`*"team":"alerting"*`}, args)
}

func TestGlobNotEquals(t *testing.T) {
	sql, args, err := globNotEquals("labels", "team", "alerting")
	require.NoError(t, err)
	require.Equal(t, "labels NOT GLOB ?", sql)
	require.Equal(t, []any{`*"team":"alerting"*`}, args)
}

func TestGlobKeyMissing(t *testing.T) {
	sql, args, err := globKeyMissing("labels", "team")
	require.NoError(t, err)
	require.Equal(t, "labels NOT GLOB ?", sql)
	require.Equal(t, []any{`*"team":*`}, args)
}

func TestBuildGlobPattern(t *testing.T) {
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
			pattern, err := buildGlobPattern(tt.key, tt.value)
			require.NoError(t, err)
			require.Equal(t, tt.expected, pattern)
		})
	}
}
