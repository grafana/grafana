package sync

import (
	"context"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
)

func TestGroupsClaimSync_SyncGroupsClaimHook(t *testing.T) {
	tests := []struct {
		name           string
		useExternal    bool
		id             *authn.Identity
		expectedGroups []string
	}{
		{
			name:        "flag set: user groups are replaced with external groups",
			useExternal: true,
			id: &authn.Identity{
				Type:           claims.TypeUser,
				Groups:         []string{"stored-team"},
				ExternalGroups: []string{"admins-editors", "editors-viewers", "everyone"},
			},
			expectedGroups: []string{"admins-editors", "editors-viewers", "everyone"},
		},
		{
			name:        "flag set, no external groups: groups become empty",
			useExternal: true,
			id: &authn.Identity{
				Type:           claims.TypeUser,
				Groups:         []string{"stored-team"},
				ExternalGroups: nil,
			},
			expectedGroups: nil,
		},
		{
			name:        "flag unset: stored groups are left untouched",
			useExternal: false,
			id: &authn.Identity{
				Type:           claims.TypeUser,
				Groups:         []string{"stored-team"},
				ExternalGroups: []string{"editors-viewers"},
			},
			expectedGroups: []string{"stored-team"},
		},
		{
			name:        "flag set but non-user identity: groups untouched",
			useExternal: true,
			id: &authn.Identity{
				Type:           claims.TypeServiceAccount,
				Groups:         []string{"stored-team"},
				ExternalGroups: []string{"editors-viewers"},
			},
			expectedGroups: []string{"stored-team"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := ProvideGroupsClaimSync(&setting.Cfg{IDUseExternalGroupsForGroupsClaim: tt.useExternal})
			err := s.SyncGroupsClaimHook(context.Background(), tt.id, &authn.Request{})
			require.NoError(t, err)
			assert.Equal(t, tt.expectedGroups, tt.id.GetGroups())
		})
	}
}
