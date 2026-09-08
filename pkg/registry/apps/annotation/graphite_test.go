package annotation

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFormatGraphiteText(t *testing.T) {
	assert.Equal(t, "deploy", FormatGraphiteText("deploy", ""))
	assert.Equal(t, "deploy\nv1.2.3", FormatGraphiteText("deploy", "v1.2.3"))
	assert.Equal(t, "", FormatGraphiteText("", ""))
}

func TestParseGraphiteTags(t *testing.T) {
	tests := []struct {
		name        string
		raw         any
		expected    []string
		expectedErr bool
	}{
		{name: "space-separated string", raw: "release prod", expected: []string{"release", "prod"}},
		{name: "empty string", raw: "", expected: []string{}},
		{name: "string array", raw: []any{"release", "prod"}, expected: []string{"release", "prod"}},
		{name: "empty array", raw: []any{}, expected: nil},
		{name: "non-string element rejected", raw: []any{"ok", 123}, expectedErr: true},
		{name: "missing/nil rejected", raw: nil, expectedErr: true},
		{name: "unsupported type rejected", raw: 123, expectedErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual, err := parseGraphiteTags(tt.raw)
			if tt.expectedErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.expected, actual)
		})
	}
}

func TestPostGraphiteAnnotationsCmd_Validate(t *testing.T) {
	tests := []struct {
		name        string
		cmd         PostGraphiteAnnotationsCmd
		expected    []string
		expectedErr bool
	}{
		{name: "empty what rejected", cmd: PostGraphiteAnnotationsCmd{What: "", Tags: "release"}, expectedErr: true},
		{name: "valid with space-separated tags", cmd: PostGraphiteAnnotationsCmd{What: "deploy", Tags: "release prod"}, expected: []string{"release", "prod"}},
		{name: "valid with tag array", cmd: PostGraphiteAnnotationsCmd{What: "deploy", Tags: []any{"release", "prod"}}, expected: []string{"release", "prod"}},
		{name: "valid what but invalid tags rejected", cmd: PostGraphiteAnnotationsCmd{What: "deploy", Tags: nil}, expectedErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual, err := tt.cmd.Validate()
			if tt.expectedErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.expected, actual)
		})
	}
}
