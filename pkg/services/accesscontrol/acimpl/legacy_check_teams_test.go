package acimpl

import (
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
)

func TestLegacyCheckTeamIDsIdentityScope(t *testing.T) {
	for _, tc := range []struct {
		name   string
		orgID  int64
		idType types.IdentityType
		want   []int64
	}{
		{name: "user", orgID: 12, idType: types.TypeUser, want: []int64{42}},
		{name: "service account", orgID: 12, idType: types.TypeServiceAccount, want: []int64{42}},
		{name: "global", idType: types.TypeUser},
		{name: "no organization", orgID: accesscontrol.NoOrgID, idType: types.TypeUser},
		{name: "anonymous", orgID: 12, idType: types.TypeAnonymous},
	} {
		t.Run(tc.name, func(t *testing.T) {
			requester := &authn.Identity{OrgID: tc.orgID, Type: tc.idType, TeamIDs: []int64{42}} //nolint:staticcheck // Exercise legacy numeric memberships, not team UIDs.
			require.Equal(t, tc.want, legacyCheckTeamIDs(requester))
		})
	}
}
