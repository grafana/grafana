package utils_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

func TestLegacyAuthorizer(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		output utils.OwnerReference
		found  bool
	}{
		{
			name:   "invalid",
			input:  "xxx-yyy",
			output: utils.OwnerReference{},
			found:  false,
		},
		{
			name:   "with user",
			input:  "user-a",
			output: utils.OwnerReference{Owner: utils.UserResourceOwner, Name: "a"},
			found:  true,
		},
		{
			name:   "missing user",
			input:  "user-",
			output: utils.OwnerReference{},
			found:  false,
		},
		{
			name:   "with team",
			input:  "team-b",
			output: utils.OwnerReference{Owner: utils.TeamResourceOwner, Name: "b"},
			found:  true,
		},
		{
			name:   "missing team",
			input:  "team-",
			output: utils.OwnerReference{},
			found:  false,
		},
		{
			name:   "for namespace",
			input:  "namespace",
			output: utils.OwnerReference{Owner: utils.NamespaceResourceOwner},
			found:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			output, found := utils.ParseOwnerFromName(tt.input)
			require.Equal(t, tt.output, output)
			require.Equal(t, tt.found, found)
			if tt.found {
				require.Equal(t, tt.input, output.AsName())
			}
		})
	}
}
