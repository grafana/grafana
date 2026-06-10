package sync

import (
	"context"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideGroupsClaimSync(cfg *setting.Cfg) *GroupsClaimSync {
	return &GroupsClaimSync{cfg: cfg}
}

type GroupsClaimSync struct {
	cfg *setting.Cfg
}

// SyncGroupsClaimHook aligns the identity's groups (the value returned by GetGroups,
// surfaced as SignedInUser.TeamUIDs) with how the ID token's groups claim is resolved.
//
// When id_use_external_groups_for_groups_claim is set, team membership is delivered via
// the IdP/proxy-supplied external groups (external group names are expected to match team
// UIDs / metadata.name) rather than Grafana-stored team memberships. The ID token already
// honours this via idimpl.resolveGroupsClaim, and the Zanzana merge resolver honours it via
// its useExternalGroups switch. The forward authz Check, however, derives its contextual
// team-membership tuples from authInfo.GetGroups() (authlib authz client), which returns the
// stored memberships. With team_sync disabled those are empty, so the forward Check sends no
// team contextuals and denies access the user legitimately holds through a team grant
// (e.g. creating a dashboard in a folder a team has edit on).
//
// Setting Groups to ExternalGroups under the same flag makes every GetGroups() consumer —
// including the forward Check — consistent with the ID token and the merge resolver.
func (s *GroupsClaimSync) SyncGroupsClaimHook(_ context.Context, id *authn.Identity, _ *authn.Request) error {
	if !s.cfg.IDUseExternalGroupsForGroupsClaim {
		return nil
	}

	// Mirror resolveGroupsClaim: only user identities carry a groups claim.
	if !id.IsIdentityType(claims.TypeUser) {
		return nil
	}

	id.Groups = id.ExternalGroups
	return nil
}
