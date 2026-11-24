package legacypermissions

import (
	"context"
	"fmt"
	"slices"
	"strconv"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func (s *RemoteServer) loadIdentity(ctx context.Context, ns types.NamespaceInfo, subject *authzv1.LegacyPermissionIdentity, orgID int64) (*authzv1.LegacyPermissionIdentity, error) {
	identity := &authzv1.LegacyPermissionIdentity{Type: subject.Type, Groups: slices.Clone(subject.Groups), OrgRole: string(types.RoleNone)}
	if types.IdentityType(subject.Type) == types.TypeAnonymous {
		if orgID > 0 {
			identity.OrgRole = s.loader.cfg.Anonymous.OrgRole
		}
		return identity, nil
	}
	sql := store.NewStore(s.loader.store.database, s.tracer)
	query := store.UserIdentifierQuery{UserUID: subject.Uid}
	// Match the existing AuthZ subject convention for numeric identifiers.
	if id, err := strconv.ParseInt(subject.Uid, 10, 64); err == nil {
		query = store.UserIdentifierQuery{UserID: id}
	}
	identifiers, err := sql.GetUserIdentifiers(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("load remote user identifiers: %w", err)
	}
	identity.Uid, identity.InternalId, identity.HasUniqueId = identifiers.UID, &identifiers.ID, true
	roleNamespace := ns
	roleNamespace.OrgID = orgID
	role, err := sql.GetBasicRoles(ctx, roleNamespace, store.BasicRoleQuery{UserID: identifiers.ID})
	if err != nil {
		return nil, fmt.Errorf("load remote user role: %w", err)
	}
	if role == nil {
		return nil, fmt.Errorf("remote user role is missing")
	}
	identity.IsGrafanaAdmin = role.IsAdmin
	// Global and no-membership evaluation must not inherit tenant organization grants.
	if orgID <= 0 {
		return identity, nil
	}
	identity.OrgRole = role.Role
	teams := legacy.NewLegacySQLStores(s.loader.store.database)
	teamQuery := legacy.ListUserTeamsQuery{UserUID: identifiers.UID, Pagination: common.Pagination{Limit: 50}}
	for {
		page, err := teams.ListUserTeams(ctx, ns, teamQuery)
		if err != nil {
			return nil, fmt.Errorf("load remote user teams: %w", err)
		}
		for _, team := range page.Items {
			identity.TeamIds = append(identity.TeamIds, team.ID)
		}
		if page.Continue == 0 {
			break
		}
		teamQuery.Pagination.Continue = page.Continue
	}
	return identity, nil
}
