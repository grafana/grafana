package store

import (
	"testing"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func TestBuildLabelMatcherGlob(t *testing.T) {
	tests := []struct {
		name        string
		matcher     *labels.Matcher
		wantSQL     string
		wantArgs    []any
		wantErr     bool
		errContains string
	}{
		{
			name:     "MatchEqual with non-empty value",
			matcher:  &labels.Matcher{Type: labels.MatchEqual, Name: "team", Value: "alerting"},
			wantSQL:  "labels GLOB ?",
			wantArgs: []any{`*"team":"alerting"*`},
		},
		{
			name:     "MatchEqual with empty value (Prometheus semantics)",
			matcher:  &labels.Matcher{Type: labels.MatchEqual, Name: "team", Value: ""},
			wantSQL:  `(labels GLOB ? OR labels NOT GLOB ?)`,
			wantArgs: []any{`*"team":""*`, `*"team":*`},
		},
		{
			name:     "MatchNotEqual",
			matcher:  &labels.Matcher{Type: labels.MatchNotEqual, Name: "team", Value: "alerting"},
			wantSQL:  "labels NOT GLOB ?",
			wantArgs: []any{`*"team":"alerting"*`},
		},
		{
			name:        "unsupported matcher type",
			matcher:     &labels.Matcher{Type: labels.MatchRegexp, Name: "team", Value: "alert.*"},
			wantErr:     true,
			errContains: "unsupported matcher type",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sql, args, err := buildLabelMatcherGlob("labels", tt.matcher)
			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errContains)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.wantSQL, sql)
			require.Equal(t, tt.wantArgs, args)
		})
	}
}

func TestBuildLabelMatcherJSON(t *testing.T) {
	tests := []struct {
		name        string
		dialect     migrator.Dialect
		matcher     *labels.Matcher
		wantSQL     string
		wantArgs    []any
		wantErr     bool
		errContains string
	}{
		{
			name:     "MySQL MatchEqual with non-empty value",
			dialect:  migrator.NewMysqlDialect(),
			matcher:  &labels.Matcher{Type: labels.MatchEqual, Name: "team", Value: "alerting"},
			wantSQL:  "JSON_UNQUOTE(JSON_EXTRACT(NULLIF(labels, ''), CONCAT('$.', ?))) = ?",
			wantArgs: []any{"team", "alerting"},
		},
		{
			name:     "MySQL MatchEqual with empty value",
			dialect:  migrator.NewMysqlDialect(),
			matcher:  &labels.Matcher{Type: labels.MatchEqual, Name: "team", Value: ""},
			wantSQL:  "(JSON_UNQUOTE(JSON_EXTRACT(NULLIF(labels, ''), CONCAT('$.', ?))) = ? OR JSON_EXTRACT(NULLIF(labels, ''), CONCAT('$.', ?)) IS NULL)",
			wantArgs: []any{"team", "", "team"},
		},
		{
			name:     "MySQL MatchNotEqual",
			dialect:  migrator.NewMysqlDialect(),
			matcher:  &labels.Matcher{Type: labels.MatchNotEqual, Name: "team", Value: "alerting"},
			wantSQL:  "(JSON_UNQUOTE(JSON_EXTRACT(NULLIF(labels, ''), CONCAT('$.', ?))) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(NULLIF(labels, ''), CONCAT('$.', ?))) != ?)",
			wantArgs: []any{"team", "team", "alerting"},
		},
		{
			name:     "PostgreSQL MatchEqual with non-empty value",
			dialect:  migrator.NewPostgresDialect(),
			matcher:  &labels.Matcher{Type: labels.MatchEqual, Name: "team", Value: "alerting"},
			wantSQL:  "jsonb_extract_path_text(NULLIF(labels, '')::jsonb, ?) = ?",
			wantArgs: []any{"team", "alerting"},
		},
		{
			name:     "PostgreSQL MatchEqual with empty value",
			dialect:  migrator.NewPostgresDialect(),
			matcher:  &labels.Matcher{Type: labels.MatchEqual, Name: "team", Value: ""},
			wantSQL:  "(jsonb_extract_path_text(NULLIF(labels, '')::jsonb, ?) = ? OR jsonb_extract_path_text(NULLIF(labels, '')::jsonb, ?) IS NULL)",
			wantArgs: []any{"team", "", "team"},
		},
		{
			name:     "PostgreSQL MatchNotEqual",
			dialect:  migrator.NewPostgresDialect(),
			matcher:  &labels.Matcher{Type: labels.MatchNotEqual, Name: "team", Value: "alerting"},
			wantSQL:  "(jsonb_extract_path_text(NULLIF(labels, '')::jsonb, ?) IS NULL OR jsonb_extract_path_text(NULLIF(labels, '')::jsonb, ?) != ?)",
			wantArgs: []any{"team", "team", "alerting"},
		},
		{
			name:        "unsupported matcher type",
			dialect:     migrator.NewMysqlDialect(),
			matcher:     &labels.Matcher{Type: labels.MatchRegexp, Name: "team", Value: "alert.*"},
			wantErr:     true,
			errContains: "unsupported matcher type",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sql, args, err := buildLabelMatcherJSON(tt.dialect, "labels", tt.matcher)
			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errContains)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.wantSQL, sql)
			require.Equal(t, tt.wantArgs, args)
		})
	}
}
