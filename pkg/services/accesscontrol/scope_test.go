package accesscontrol

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_ScopePrefix(t *testing.T) {
	tests := []struct {
		name  string
		scope string
		want  string
	}{
		{
			name:  "empty",
			scope: "",
			want:  "",
		},
		{
			name:  "minimal",
			scope: ":",
			want:  ":",
		},
		{
			name:  "datasources",
			scope: "datasources:",
			want:  "datasources:",
		},
		{
			name:  "datasources name",
			scope: "datasources:name:testds",
			want:  "datasources:name:",
		},
		{
			name:  "datasources with colons in name",
			scope: "datasources:name:test:a::ds",
			want:  "datasources:name:",
		},
		{
			name:  "prefix",
			scope: "datasources:name:",
			want:  "datasources:name:",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			prefix := ScopePrefix(tt.scope)

			assert.Equal(t, tt.want, prefix)
		})
	}
}

func TestWildcardsFromPrefix(t *testing.T) {
	type testCase struct {
		desc     string
		prefix   string
		expected Wildcards
	}

	tests := []testCase{
		{
			desc:     "should handle empty prefix",
			prefix:   "",
			expected: Wildcards{"*"},
		},
		{
			desc:     "should generate wildcards for prefix",
			prefix:   "dashboards:uid",
			expected: Wildcards{"*", "dashboards:*", "dashboards:uid:*"},
		},
		{
			desc:     "should handle trailing :",
			prefix:   "dashboards:uid:",
			expected: Wildcards{"*", "dashboards:*", "dashboards:uid:*"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			wildcards := WildcardsFromPrefix(tt.prefix)
			assert.Equal(t, tt.expected, wildcards)
		})
	}
}
