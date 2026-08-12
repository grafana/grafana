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

// SyncGroupsClaimHook makes GetGroups() return the IdP/proxy external groups under
// id_use_external_groups_for_groups_claim, so every consumer — the forward authz Check,
// the Zanzana merge resolver, and the ID token — agrees on team membership. Mirrors
// idimpl.resolveGroupsClaim. Without it the forward Check sees empty stored teams
// (team_sync disabled) and denies team-granted access.
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
