package sqlmacro

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSplitTrailingSQLCommenter(t *testing.T) {
	tests := []struct {
		name     string
		sql      string
		markers  []string
		wantBody string
		wantTag  string
	}{
		{
			name:     "trailing tag before terminator",
			sql:      "SELECT 1 AS value\n/*application='grafana',source='bi'*/;",
			wantBody: "SELECT 1 AS value\n",
			wantTag:  "/*application='grafana',source='bi'*/;",
		},
		{
			name:     "trailing tag without terminator",
			sql:      "SELECT 1 /*application='grafana'*/",
			wantBody: "SELECT 1 ",
			wantTag:  "/*application='grafana'*/",
		},
		{
			name:     "url-encoded key and value",
			sql:      "SELECT 1 /*a%20b='%2Fparam*d'*/",
			wantBody: "SELECT 1 ",
			wantTag:  "/*a%20b='%2Fparam*d'*/",
		},
		{
			name:     "escaped quote in value",
			sql:      `SELECT 1 /*controller='it\'s'*/`,
			wantBody: "SELECT 1 ",
			wantTag:  `/*controller='it\'s'*/`,
		},
		{
			name:     "paren in value does not let a macro complete across the boundary",
			sql:      "SELECT $__timeFilter(t /*k='a)b'*/",
			wantBody: "SELECT $__timeFilter(t ",
			wantTag:  "/*k='a)b'*/",
		},
		{
			name:     "value containing */ is not a self-contained tag",
			sql:      "SELECT 1 /*k='*/ DROP TABLE t --'*/",
			wantBody: "SELECT 1 /*k='*/ DROP TABLE t --'*/",
			wantTag:  "",
		},
		{
			name:     "overlapping opener and closer is not a tag",
			sql:      "SELECT 1 /*/",
			wantBody: "SELECT 1 /*/",
			wantTag:  "",
		},
		{
			name:     "repeated trailing semicolons",
			sql:      "SELECT 1 /*app='grafana'*/;;",
			wantBody: "SELECT 1 ",
			wantTag:  "/*app='grafana'*/;;",
		},
		{
			name:     "tag inside a trailing line comment is not revived",
			sql:      "SELECT 1\n-- note /*k='v'*/",
			markers:  []string{"--", "#"},
			wantBody: "SELECT 1\n-- note /*k='v'*/",
			wantTag:  "",
		},
		{
			name:     "tag inside a trailing hash comment is not revived",
			sql:      "SELECT 1 # /*k='v'*/",
			markers:  []string{"--", "#"},
			wantBody: "SELECT 1 # /*k='v'*/",
			wantTag:  "",
		},
		{
			name:     "tag on its own line after a line comment is still split",
			sql:      "SELECT 1 -- note\n/*app='grafana'*/",
			markers:  []string{"--", "#"},
			wantBody: "SELECT 1 -- note\n",
			wantTag:  "/*app='grafana'*/",
		},
		{
			name:     "hash is ordinary syntax when the engine does not mark it",
			sql:      "SELECT * FROM #tmp /*app='grafana'*/",
			markers:  []string{"--"},
			wantBody: "SELECT * FROM #tmp ",
			wantTag:  "/*app='grafana'*/",
		},
		{
			name:     "postgres json operator does not block the tag",
			sql:      "SELECT data#>'{a}' FROM t /*app='grafana'*/",
			markers:  []string{"--"},
			wantBody: "SELECT data#>'{a}' FROM t ",
			wantTag:  "/*app='grafana'*/",
		},
		{
			name:     "inline (non-trailing) tag is left in place",
			sql:      "SELECT 1 /*k='v'*/ WHERE x = 1",
			wantBody: "SELECT 1 /*k='v'*/ WHERE x = 1",
			wantTag:  "",
		},
		{
			name:     "plain comment is not a tag",
			sql:      "SELECT 1 /* just a note */",
			wantBody: "SELECT 1 /* just a note */",
			wantTag:  "",
		},
		{
			name:     "no comment",
			sql:      "SELECT 1 FROM t",
			wantBody: "SELECT 1 FROM t",
			wantTag:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, tag := SplitTrailingSQLCommenter(tt.sql, tt.markers...)
			require.Equal(t, tt.wantBody, body)
			require.Equal(t, tt.wantTag, tag)
		})
	}
}
