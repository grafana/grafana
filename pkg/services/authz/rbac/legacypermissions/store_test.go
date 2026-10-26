package legacypermissions

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationPermissionStorePermissionsForActions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	database := db.NewTestStore(t)
	store := permissionStore{sql: database}

	direct := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:direct"}
	write := ac.Permission{Action: "dashboards:write", Scope: "dashboards:uid:direct"}
	actionSet := ac.Permission{Action: "dashboards:view", Scope: "dashboards:uid:action-set"}
	custom := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:custom"}
	organization := ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:organization"}
	quoted := ac.Permission{Action: "dashboards:read') OR 1=1 --", Scope: "dashboards:uid:quoted"}
	storedDirect := direct
	storedDirect.Kind = "dashboards"

	seedPermissionStoreGrants(t, database, "managed:global", ac.GlobalOrgID, 7, storedDirect, write, actionSet, quoted)
	seedPermissionStoreGrants(t, database, "custom:global", ac.GlobalOrgID, 7, custom)
	seedPermissionStoreGrants(t, database, "managed:organization", 1, 7, organization)
	seedPermissionStoreGrants(t, database, "managed:other-user", ac.GlobalOrgID, 8,
		ac.Permission{Action: direct.Action, Scope: "dashboards:uid:other-user"})
	seedPermissionStoreGrants(t, database, "managed:other-organization", 2, 7,
		ac.Permission{Action: direct.Action, Scope: "dashboards:uid:other-organization"})

	for _, tc := range []struct {
		name    string
		query   ac.GetUserPermissionsQuery
		actions []string
		want    []ac.Permission
	}{
		{
			name:    "nil actions preserve unfiltered enumeration",
			query:   ac.GetUserPermissionsQuery{OrgID: ac.GlobalOrgID, UserID: 7},
			actions: nil,
			want:    []ac.Permission{direct, write, actionSet, custom, quoted},
		},
		{
			name:    "empty actions preserve unfiltered enumeration",
			query:   ac.GetUserPermissionsQuery{OrgID: ac.GlobalOrgID, UserID: 7},
			actions: []string{},
			want:    []ac.Permission{direct, write, actionSet, custom, quoted},
		},
		{
			name:    "single action excludes unrelated grants and assignments",
			query:   ac.GetUserPermissionsQuery{OrgID: ac.GlobalOrgID, UserID: 7},
			actions: []string{direct.Action},
			want:    []ac.Permission{direct, custom},
		},
		{
			name:    "multiple actions include direct and action-set grants",
			query:   ac.GetUserPermissionsQuery{OrgID: ac.GlobalOrgID, UserID: 7},
			actions: []string{direct.Action, actionSet.Action},
			want:    []ac.Permission{direct, actionSet, custom},
		},
		{
			name:    "duplicate actions do not duplicate rows",
			query:   ac.GetUserPermissionsQuery{OrgID: ac.GlobalOrgID, UserID: 7},
			actions: []string{direct.Action, direct.Action},
			want:    []ac.Permission{direct, custom},
		},
		{
			name:    "unknown action returns no grants",
			query:   ac.GetUserPermissionsQuery{OrgID: ac.GlobalOrgID, UserID: 7},
			actions: []string{"dashboards:unknown"},
			want:    []ac.Permission{},
		},
		{
			name:    "action values are bound as literal parameters",
			query:   ac.GetUserPermissionsQuery{OrgID: ac.GlobalOrgID, UserID: 7},
			actions: []string{quoted.Action},
			want:    []ac.Permission{quoted},
		},
		{
			name: "action parameters follow role-prefix parameters",
			query: ac.GetUserPermissionsQuery{
				OrgID: ac.GlobalOrgID, UserID: 7, RolePrefixes: []string{ac.ManagedRolePrefix},
			},
			actions: []string{direct.Action, actionSet.Action},
			want:    []ac.Permission{direct, actionSet},
		},
		{
			name: "managed-permission filter composes without role prefixes",
			query: ac.GetUserPermissionsQuery{
				OrgID: ac.GlobalOrgID, UserID: 7, ExcludeRedundantManagedPermissions: true,
			},
			actions: []string{direct.Action, actionSet.Action},
			want:    []ac.Permission{actionSet, custom},
		},
		{
			name: "managed-permission filter composes with role prefixes",
			query: ac.GetUserPermissionsQuery{
				OrgID: ac.GlobalOrgID, UserID: 7, RolePrefixes: []string{ac.ManagedRolePrefix},
				ExcludeRedundantManagedPermissions: true,
			},
			actions: []string{direct.Action, actionSet.Action},
			want:    []ac.Permission{actionSet},
		},
		{
			name:    "organization queries retain global assignments",
			query:   ac.GetUserPermissionsQuery{OrgID: 1, UserID: 7},
			actions: []string{direct.Action},
			want:    []ac.Permission{direct, custom, organization},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := store.permissionsForActions(t.Context(), tc.query, tc.actions)

			require.NoError(t, err)
			require.ElementsMatch(t, tc.want, got)
		})
	}
}

func seedPermissionStoreGrants(
	t *testing.T,
	database db.DB,
	name string,
	orgID int64,
	userID int64,
	permissions ...ac.Permission,
) {
	t.Helper()

	require.NoError(t, database.WithDbSession(t.Context(), func(session *db.Session) error {
		now := time.Now()
		role := ac.Role{Name: name, UID: name, OrgID: orgID, Created: now, Updated: now}
		if _, err := session.Insert(&role); err != nil {
			return err
		}

		for _, permission := range permissions {
			permission.RoleID = role.ID
			permission.Created = now
			permission.Updated = now

			if _, err := session.Insert(&permission); err != nil {
				return err
			}
		}

		_, err := session.Insert(&ac.UserRole{RoleID: role.ID, OrgID: orgID, UserID: userID, Created: now})
		if err != nil {
			return fmt.Errorf("insert user role: %w", err)
		}

		return nil
	}))
}
