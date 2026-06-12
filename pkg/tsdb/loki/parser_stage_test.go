package loki

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildParserStage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		hints     map[string]string
		wantStage string
		wantErr   string
	}{
		{name: "json", hints: map[string]string{"PARSER": "json"}, wantStage: "json"},
		{name: "logfmt", hints: map[string]string{"PARSER": "logfmt"}, wantStage: "logfmt"},
		{name: "unpack", hints: map[string]string{"PARSER": "unpack"}, wantStage: "unpack"},
		{name: "empty when no hints"},
		{name: "pattern requires companion", hints: map[string]string{"PARSER": "pattern"}, wantErr: "pattern() hint required"},
		{
			name: "pattern with expr",
			hints: map[string]string{
				"PARSER":  "pattern",
				"PATTERN": `<ip> - - <_> "<method> <path> <_>" <status> <_>`,
			},
			wantStage: `pattern "<ip> - - <_> \"<method> <path> <_>\" <status> <_>"`,
		},
		{name: "pattern without parser hint", hints: map[string]string{"PATTERN": "<status>"}, wantErr: "parser('pattern') hint required"},
		{name: "regexp requires companion", hints: map[string]string{"PARSER": "regexp"}, wantErr: "regexp_expr() hint required"},
		{
			name: "regexp requires named capture",
			hints: map[string]string{
				"PARSER":      "regexp",
				"REGEXP_EXPR": `\d+`,
			},
			wantErr: "named sub-match",
		},
		{
			name: "regexp with named capture",
			hints: map[string]string{
				"PARSER":      "regexp",
				"REGEXP_EXPR": `(?P<ip>\d+)`,
			},
			wantStage: "regexp `(?P<ip>\\d+)`",
		},
		{name: "unsupported parser", hints: map[string]string{"PARSER": "auto"}, wantErr: "unsupported parser"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			stage, err := buildParserStage(tt.hints)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.wantStage, stage)
		})
	}
}

func TestParserHintsFromSchemaContext(t *testing.T) {
	t.Parallel()

	hints := parserHintsFromSchemaContext(map[string]string{
		"PARSER":  "pattern",
		"PATTERN": "<status>",
		"RATE":    "1m",
	})
	require.Equal(t, map[string]string{
		"PARSER":  "pattern",
		"PATTERN": "<status>",
	}, hints)

	hints = parserHintsFromSchemaContext(map[string]string{" parser ": "json"})
	require.Equal(t, map[string]string{"PARSER": "json"}, hints)

	require.Nil(t, parserHintsFromSchemaContext(nil))
}
