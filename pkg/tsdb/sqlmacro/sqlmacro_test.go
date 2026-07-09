package sqlmacro

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSplitTrailingSQLCommenter(t *testing.T) {
	tests := []struct {
		name     string
		sql      string
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
			body, tag := SplitTrailingSQLCommenter(tt.sql)
			require.Equal(t, tt.wantBody, body)
			require.Equal(t, tt.wantTag, tag)
		})
	}
}
