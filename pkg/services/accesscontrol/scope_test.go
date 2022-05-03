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
