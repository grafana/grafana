package accesscontrol

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestResourcePermission_Match(t *testing.T) {
	tests := []struct {
		name          string
		perm          ResourcePermission
		targetActions []string
		want          bool
	}{
		{
			name: "should match",
			perm: ResourcePermission{
				Actions: []string{},
			},
			targetActions: []string{},
			want:          true,
		},
		{
			name: "should match because user has the correct permissions",
			perm: ResourcePermission{
				Actions: []string{"datasources:read", "datasources:write", "datasources:create"},
			},
			targetActions: []string{"datasources:read", "datasources:write", "datasources:create"},
			want:          true,
		},
		{
			name: "should not match because user has less permissions than needed",
			perm: ResourcePermission{
				Actions: []string{"datasources:read"},
			},
			targetActions: []string{"datasources:read", "datasources:write"},
			want:          false,
		},
		{
			name: "should match because user has more permissions than needed",
			perm: ResourcePermission{
				Actions: []string{"datasources:read", "datasources:write"},
			},
			targetActions: []string{"datasources:read"},
			want:          true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			match := tt.perm.Match(tt.targetActions)
			assert.Equal(t, tt.want, match)
		})
	}
}
