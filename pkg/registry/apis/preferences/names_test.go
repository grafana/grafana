package preferences

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLegacyAuthorizer(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		output OwnerReference
		found  bool
	}{
		{
			name:   "invalid",
			input:  "xxx:yyy",
			output: OwnerReference{},
			found:  false,
		},
		{
			name:   "with user",
			input:  "user:a",
			output: OwnerReference{Owner: UserResourceOwner, Name: "a"},
			found:  true,
		},
		{
			name:   "missing user",
			input:  "user:",
			output: OwnerReference{},
			found:  false,
		},
		{
			name:   "with team",
			input:  "team:b",
			output: OwnerReference{Owner: TeamResourceOwner, Name: "b"},
			found:  true,
		},
		{
			name:   "missing team",
			input:  "team:",
			output: OwnerReference{},
			found:  false,
		},
		{
			name:   "for namespace",
			input:  "namespace",
			output: OwnerReference{Owner: NamespaceResourceOwner},
			found:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			output, found := ParseOwnerFromName(tt.input)
			require.Equal(t, tt.output, output)
			require.Equal(t, tt.found, found)
			if tt.found {
				require.Equal(t, tt.input, output.AsName())
			}
		})
	}
}
