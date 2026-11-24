package acimpl

import (
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestBuildLegacyCheckRequestTeamIDs(t *testing.T) {
	const orgID int64 = 12
	const teamID int64 = 42
	for _, tc := range []struct {
		name      string
		requester identity.Requester
		want      []int64
	}{
		{name: "user memberships", requester: &user.SignedInUser{UserID: 1, UserUID: "checked-user", OrgID: orgID, TeamIDs: []int64{teamID}}, want: []int64{teamID}}, //nolint:staticcheck // Exercise the legacy numeric membership snapshot.
		{name: "explicitly empty", requester: &user.SignedInUser{UserID: 1, UserUID: "checked-user", OrgID: orgID, TeamIDs: []int64{}}, want: []int64{}},             //nolint:staticcheck // An empty snapshot differs from unavailable memberships.
		{name: "unavailable", requester: &user.SignedInUser{UserID: 1, UserUID: "checked-user", OrgID: orgID}},
		{name: "authentication identity", requester: &authn.Identity{UID: "checked-user", Type: types.TypeUser, OrgID: orgID, TeamIDs: []int64{teamID}}, want: []int64{teamID}},
		{name: "static requester has no membership implementation", requester: &identity.StaticRequester{UserUID: "checked-user", Type: types.TypeUser, OrgID: orgID}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			evaluator := accesscontrol.EvalPermission("dashboards:read")
			got, err := ProvideAccessControlTest().buildLegacyCheckRequest(tc.requester, evaluator, types.OrgNamespaceFormatter)
			require.NoError(t, err)
			want := legacyclient.LegacyCheckRequest{
				Namespace: "org-12", RequesterOrgID: ptr.To(orgID), Subject: "user:checked-user",
				Evaluator: evaluator, TeamIDs: tc.want, Restriction: &legacyclient.LegacyActionRestriction{},
			}
			require.Equal(t, want, got)

			if teams := tc.requester.GetTeams(); len(teams) > 0 {
				teams[0]++
			}
			require.Equal(t, want, got)
		})
	}
}

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
			requester := &authn.Identity{OrgID: tc.orgID, Type: tc.idType, TeamIDs: []int64{42}}
			require.Equal(t, tc.want, legacyCheckTeamIDs(requester))
		})
	}
}
