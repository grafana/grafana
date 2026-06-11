package zanzana

import (
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/structpb"
)

func TestTupleStringWithoutCondition(t *testing.T) {
	tuple := &openfgav1.TupleKey{
		User:     "user:123",
		Relation: "view",
		Object:   "folder:abc",
		Condition: &openfgav1.RelationshipCondition{
			Name: "group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"group_resource": structpb.NewStringValue("dashboards.grafana.app/dashboards"),
				},
			},
		},
	}

	result := TupleStringWithoutCondition(tuple)

	// Verify the condition is preserved
	require.NotNil(t, tuple.Condition)
	require.Equal(t, "group_filter", tuple.Condition.Name)

	// Verify the string doesn't include the condition
	require.NotContains(t, result, "group_filter")
	require.Contains(t, result, "user:123")
	require.Contains(t, result, "view")
	require.Contains(t, result, "folder:abc")
}

func TestConvertRolePermissionsToTuples(t *testing.T) {
	t.Run("should convert folder permissions", func(t *testing.T) {
		permissions := []RolePermission{
			{Action: "folders:read", Kind: "folders", Identifier: "folder1"},
			{Action: "folders:write", Kind: "folders", Identifier: "folder1"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-123", permissions)
		require.NoError(t, err)
		require.Len(t, tuples, 2)

		// Verify all tuples have the correct subject
		for _, tuple := range tuples {
			require.Equal(t, "role:role-123#assignee", tuple.User)
			require.Equal(t, "folder:folder1", tuple.Object)
		}

		// Verify relations are correct
		relations := []string{tuples[0].Relation, tuples[1].Relation}
		require.Contains(t, relations, "get")
		require.Contains(t, relations, "update")
	})

	t.Run("should convert dashboard permissions", func(t *testing.T) {
		permissions := []RolePermission{
			{Action: "dashboards:read", Kind: "dashboards", Identifier: "dash1"},
			{Action: "dashboards:delete", Kind: "dashboards", Identifier: "dash1"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-456", permissions)
		require.NoError(t, err)
		require.Len(t, tuples, 2)

		// Verify all tuples have the correct subject
		for _, tuple := range tuples {
			require.Equal(t, "role:role-456#assignee", tuple.User)
			require.Contains(t, tuple.Object, "resource:")
			require.Contains(t, tuple.Object, "dashboard")
		}
	})

	t.Run("should handle wildcard scopes", func(t *testing.T) {
		permissions := []RolePermission{
			{Action: "folders:read", Kind: "folders", Identifier: "*"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-789", permissions)
		require.NoError(t, err)
		require.Len(t, tuples, 1)

		tuple := tuples[0]
		require.Equal(t, "role:role-789#assignee", tuple.User)
		require.Contains(t, tuple.Object, "group_resource:")
	})

	t.Run("should skip untranslatable permissions", func(t *testing.T) {
		permissions := []RolePermission{
			{Action: "folders:read", Kind: "folders", Identifier: "folder1"},
			{Action: "unknown:action", Kind: "unknown", Identifier: "something"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-abc", permissions)
		require.NoError(t, err)
		// Only the valid permission should be converted
		require.Len(t, tuples, 1)
		require.Equal(t, "role:role-abc#assignee", tuples[0].User)
		require.Equal(t, "folder:folder1", tuples[0].Object)
	})

	t.Run("should merge folder resource tuples", func(t *testing.T) {
		permissions := []RolePermission{
			{Action: "dashboards:read", Kind: "folders", Identifier: "parent-folder"},
			{Action: "dashboards:write", Kind: "folders", Identifier: "parent-folder"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-merge", permissions)
		require.NoError(t, err)
		// Folder resource tuples should be merged
		require.Greater(t, len(tuples), 0)

		// All tuples should have the correct subject
		for _, tuple := range tuples {
			require.Equal(t, "role:role-merge#assignee", tuple.User)
		}
	})

	t.Run("should return nil for empty permissions", func(t *testing.T) {
		tuples, err := ConvertRolePermissionsToTuples("role-empty", []RolePermission{})
		require.NoError(t, err)
		require.Nil(t, tuples)
	})

	t.Run("should deduplicate identical tuples", func(t *testing.T) {
		permissions := []RolePermission{
			{Action: "folders:read", Kind: "folders", Identifier: "folder1"},
			{Action: "folders:read", Kind: "folders", Identifier: "folder1"}, // Duplicate
		}

		tuples, err := ConvertRolePermissionsToTuples("role-dedup", permissions)
		require.NoError(t, err)
		// Should only have 1 tuple, not 2
		require.Len(t, tuples, 1)
		require.Equal(t, "role:role-dedup#assignee", tuples[0].User)
		require.Equal(t, "get", tuples[0].Relation)
		require.Equal(t, "folder:folder1", tuples[0].Object)
	})

	t.Run("should reconcile role-management permissions", func(t *testing.T) {
		// A typical "Grafana Admin" set of role-management permissions: read all roles,
		// write any role (delegated), and delete any role (delegated). The reconciler
		// must emit one group_resource tuple per IAM resource so the bound principal
		// can act on the iam.grafana.app/{roles,globalroles} APIs.
		permissions := []RolePermission{
			{Action: "roles:read", Kind: "roles", Identifier: "*"},
			{Action: "roles:write", Kind: "permissions", Identifier: "delegate"},
			{Action: "roles:delete", Kind: "permissions", Identifier: "delegate"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-admin", permissions)
		require.NoError(t, err)

		require.ElementsMatch(t, tupleKeyStrings([]*openfgav1.TupleKey{
			{User: "role:role-admin#assignee", Relation: "get", Object: "group_resource:iam.grafana.app/roles"},
			{User: "role:role-admin#assignee", Relation: "get", Object: "group_resource:iam.grafana.app/globalroles"},
			{User: "role:role-admin#assignee", Relation: "edit", Object: "group_resource:iam.grafana.app/roles"},
			{User: "role:role-admin#assignee", Relation: "delete", Object: "group_resource:iam.grafana.app/roles"},
		}), tupleKeyStrings(tuples))
	})

	t.Run("scoped role-management permissions are dropped", func(t *testing.T) {
		// A scoped role-management permission (e.g. roles:uid:specific) cannot
		// be expressed in Zanzana — the FGA schema for iam.grafana.app only
		// exposes group_resource, not a per-instance resource. Translating
		// these would silently broaden the grant to all roles, so we drop them
		// entirely (read, write, and delete all behave the same).
		permissions := []RolePermission{
			{Action: "roles:read", Kind: "roles", Identifier: "specific-role"},
			{Action: "roles:write", Kind: "roles", Identifier: "specific-role"},
			{Action: "roles:delete", Kind: "roles", Identifier: "specific-role"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-scoped", permissions)
		require.NoError(t, err)
		require.Empty(t, tuples)
	})

	t.Run("should reconcile global users-writer permissions", func(t *testing.T) {
		// A "global users writer" (Grafana Admin) set: the users:* family plus the
		// permissions sub-actions, mapping to full CRUD + permission relations.
		permissions := []RolePermission{
			{Action: "users:create", Kind: "", Identifier: ""},
			{Action: "users:read", Kind: "global.users", Identifier: "*"},
			{Action: "users:write", Kind: "global.users", Identifier: "*"},
			{Action: "users:delete", Kind: "global.users", Identifier: "*"},
			{Action: "users.permissions:read", Kind: "users", Identifier: "*"},
			{Action: "users.permissions:write", Kind: "global.users", Identifier: "*"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-users-writer", permissions)
		require.NoError(t, err)

		require.ElementsMatch(t, tupleKeyStrings([]*openfgav1.TupleKey{
			{User: "role:role-users-writer#assignee", Relation: "get", Object: "group_resource:iam.grafana.app/users"},
			{User: "role:role-users-writer#assignee", Relation: "update", Object: "group_resource:iam.grafana.app/users"},
			{User: "role:role-users-writer#assignee", Relation: "create", Object: "group_resource:iam.grafana.app/users"},
			{User: "role:role-users-writer#assignee", Relation: "delete", Object: "group_resource:iam.grafana.app/users"},
			{User: "role:role-users-writer#assignee", Relation: "get_permissions", Object: "group_resource:iam.grafana.app/users"},
			{User: "role:role-users-writer#assignee", Relation: "set_permissions", Object: "group_resource:iam.grafana.app/users"},
		}), tupleKeyStrings(tuples))
	})

	t.Run("should reconcile org-admin (org.users) permissions", func(t *testing.T) {
		// basic_admin (Org Admin) carries only the org.users:* family plus
		// users.permissions:read. Under the union model these reach the same users
		// relations as the global family, so the Org Admin is functional.
		permissions := []RolePermission{
			{Action: "org.users:read", Kind: "users", Identifier: "*"},
			{Action: "org.users:write", Kind: "users", Identifier: "*"},
			{Action: "org.users:add", Kind: "users", Identifier: "*"},
			{Action: "org.users:remove", Kind: "users", Identifier: "*"},
			{Action: "users.permissions:read", Kind: "users", Identifier: "*"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-org-admin", permissions)
		require.NoError(t, err)

		require.ElementsMatch(t, tupleKeyStrings([]*openfgav1.TupleKey{
			{User: "role:role-org-admin#assignee", Relation: "get", Object: "group_resource:iam.grafana.app/users"},
			{User: "role:role-org-admin#assignee", Relation: "update", Object: "group_resource:iam.grafana.app/users"},
			{User: "role:role-org-admin#assignee", Relation: "delete", Object: "group_resource:iam.grafana.app/users"},
			{User: "role:role-org-admin#assignee", Relation: "get_permissions", Object: "group_resource:iam.grafana.app/users"},
		}), tupleKeyStrings(tuples))
	})

	t.Run("global and org families dedupe to the same tuples", func(t *testing.T) {
		// users:read and org.users:read both grant `get` on the users resource;
		// the resulting tuples are identical and collapse to one.
		permissions := []RolePermission{
			{Action: "users:read", Kind: "global.users", Identifier: "*"},
			{Action: "org.users:read", Kind: "users", Identifier: "*"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-dedup-users", permissions)
		require.NoError(t, err)
		require.ElementsMatch(t, tupleKeyStrings([]*openfgav1.TupleKey{
			{User: "role:role-dedup-users#assignee", Relation: "get", Object: "group_resource:iam.grafana.app/users"},
		}), tupleKeyStrings(tuples))
	})

	t.Run("should reconcile role-assignment permissions to rolebindings", func(t *testing.T) {
		// users.roles:* gate iam.grafana.app/rolebindings, not users. read is
		// scoped users:*; add/remove are scoped permissions:type:delegate.
		permissions := []RolePermission{
			{Action: "users.roles:read", Kind: "users", Identifier: "*"},
			{Action: "users.roles:add", Kind: "permissions", Identifier: "delegate"},
			{Action: "users.roles:remove", Kind: "permissions", Identifier: "delegate"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-assigner", permissions)
		require.NoError(t, err)

		require.ElementsMatch(t, tupleKeyStrings([]*openfgav1.TupleKey{
			{User: "role:role-assigner#assignee", Relation: "get", Object: "group_resource:iam.grafana.app/rolebindings"},
			{User: "role:role-assigner#assignee", Relation: "create", Object: "group_resource:iam.grafana.app/rolebindings"},
			{User: "role:role-assigner#assignee", Relation: "update", Object: "group_resource:iam.grafana.app/rolebindings"},
			{User: "role:role-assigner#assignee", Relation: "delete", Object: "group_resource:iam.grafana.app/rolebindings"},
		}), tupleKeyStrings(tuples))
	})

	t.Run("actions with no iam verb are dropped", func(t *testing.T) {
		// These gate only legacy HTTP endpoints — no iam verb maps to them, so there
		// is no relation to grant.
		permissions := []RolePermission{
			{Action: "users:enable", Kind: "global.users", Identifier: "*"},
			{Action: "users:disable", Kind: "global.users", Identifier: "*"},
			{Action: "users:logout", Kind: "global.users", Identifier: "*"},
			{Action: "users.authtoken:read", Kind: "global.users", Identifier: "*"},
			{Action: "users.password:write", Kind: "global.users", Identifier: "*"},
			{Action: "users.quotas:write", Kind: "global.users", Identifier: "*"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-noop", permissions)
		require.NoError(t, err)
		require.Empty(t, tuples)
	})

	t.Run("scoped user-management permissions are dropped", func(t *testing.T) {
		// Specific-instance scopes can't be expressed (users is uid-based in FGA
		// while the scope is id-based; rolebindings is wildcard-only). Create is
		// the exception — it carries no scope and always translates.
		permissions := []RolePermission{
			{Action: "users:read", Kind: "users", Identifier: "1"},
			{Action: "org.users:write", Kind: "users", Identifier: "abc"},
			{Action: "users.roles:read", Kind: "users", Identifier: "5"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-user-scoped", permissions)
		require.NoError(t, err)
		require.Empty(t, tuples)
	})

	t.Run("should combine folder and user permissions", func(t *testing.T) {
		permissions := []RolePermission{
			{Action: "folders:read", Kind: "folders", Identifier: "folder1"},
			{Action: "users.permissions:read", Kind: "users", Identifier: "*"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-mixed", permissions)
		require.NoError(t, err)

		require.ElementsMatch(t, tupleKeyStrings([]*openfgav1.TupleKey{
			{User: "role:role-mixed#assignee", Relation: "get", Object: "folder:folder1"},
			{User: "role:role-mixed#assignee", Relation: "get_permissions", Object: "group_resource:iam.grafana.app/users"},
		}), tupleKeyStrings(tuples))
	})

	t.Run("should reconcile team-management permissions", func(t *testing.T) {
		// A role that can fully manage teams: read/write/create/delete plus team
		// permissions. Each maps to a single relation on iam.grafana.app/teams.
		permissions := []RolePermission{
			{Action: "teams:read", Kind: "teams", Identifier: "*"},
			{Action: "teams:write", Kind: "teams", Identifier: "*"},
			{Action: "teams:create", Kind: "", Identifier: ""},
			{Action: "teams:delete", Kind: "teams", Identifier: "*"},
			{Action: "teams.permissions:read", Kind: "teams", Identifier: "*"},
			{Action: "teams.permissions:write", Kind: "teams", Identifier: "*"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-team-admin", permissions)
		require.NoError(t, err)

		require.ElementsMatch(t, tupleKeyStrings([]*openfgav1.TupleKey{
			{User: "role:role-team-admin#assignee", Relation: "get", Object: "group_resource:iam.grafana.app/teams"},
			{User: "role:role-team-admin#assignee", Relation: "update", Object: "group_resource:iam.grafana.app/teams"},
			{User: "role:role-team-admin#assignee", Relation: "create", Object: "group_resource:iam.grafana.app/teams"},
			{User: "role:role-team-admin#assignee", Relation: "delete", Object: "group_resource:iam.grafana.app/teams"},
			{User: "role:role-team-admin#assignee", Relation: "get_permissions", Object: "group_resource:iam.grafana.app/teams"},
			{User: "role:role-team-admin#assignee", Relation: "set_permissions", Object: "group_resource:iam.grafana.app/teams"},
		}), tupleKeyStrings(tuples))
	})

	t.Run("should reconcile team and user role-assignment permissions to the same rolebindings", func(t *testing.T) {
		// teams.roles:* and users.roles:* both gate iam.grafana.app/rolebindings —
		// team and user role-assignments are not distinguished at the group_resource
		// level — so their tuples dedupe onto the same object.
		permissions := []RolePermission{
			{Action: "teams.roles:read", Kind: "teams", Identifier: "*"},
			{Action: "teams.roles:add", Kind: "permissions", Identifier: "delegate"},
			{Action: "teams.roles:remove", Kind: "permissions", Identifier: "delegate"},
			{Action: "users.roles:read", Kind: "users", Identifier: "*"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-assigner", permissions)
		require.NoError(t, err)

		require.ElementsMatch(t, tupleKeyStrings([]*openfgav1.TupleKey{
			{User: "role:role-assigner#assignee", Relation: "get", Object: "group_resource:iam.grafana.app/rolebindings"},
			{User: "role:role-assigner#assignee", Relation: "create", Object: "group_resource:iam.grafana.app/rolebindings"},
			{User: "role:role-assigner#assignee", Relation: "update", Object: "group_resource:iam.grafana.app/rolebindings"},
			{User: "role:role-assigner#assignee", Relation: "delete", Object: "group_resource:iam.grafana.app/rolebindings"},
		}), tupleKeyStrings(tuples))
	})

	t.Run("scoped team-management permissions are dropped", func(t *testing.T) {
		// Specific-team scopes (teams:id:<n>) cannot be expressed: the FGA teams
		// type is uid-based while the legacy scope is id-based, so they are dropped.
		// teams:create is exempt because the mapper authorizes it without a scope.
		permissions := []RolePermission{
			{Action: "teams:read", Kind: "teams", Identifier: "5"},
			{Action: "teams:write", Kind: "teams", Identifier: "5"},
			{Action: "teams.permissions:write", Kind: "teams", Identifier: "5"},
			{Action: "teams.roles:read", Kind: "teams", Identifier: "5"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-team-scoped", permissions)
		require.NoError(t, err)
		require.Empty(t, tuples)
	})
}

func TestUserManagementToTuples(t *testing.T) {
	const subject = "role:role-1#assignee"
	const usersObject = "group_resource:iam.grafana.app/users"
	const roleBindingsObject = "group_resource:iam.grafana.app/rolebindings"

	t.Run("maps each action to its tuples under an all-scope", func(t *testing.T) {
		cases := []struct {
			action     string
			kind       string
			identifier string
			expected   []*openfgav1.TupleKey
		}{
			// users:create carries no scope (skipScope) and always translates.
			{"users:create", "", "", []*openfgav1.TupleKey{
				{User: subject, Relation: "create", Object: usersObject},
			}},
			// The global (users:*) and org (org.users:*) families converge on the
			// same users relations.
			{"users:read", "global.users", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "get", Object: usersObject},
			}},
			{"org.users:read", "users", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "get", Object: usersObject},
			}},
			{"users:write", "global.users", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "update", Object: usersObject},
			}},
			{"org.users:write", "users", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "update", Object: usersObject},
			}},
			{"users:delete", "global.users", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "delete", Object: usersObject},
			}},
			{"org.users:remove", "users", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "delete", Object: usersObject},
			}},
			{"users.permissions:read", "users", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "get_permissions", Object: usersObject},
			}},
			{"users.permissions:write", "global.users", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "set_permissions", Object: usersObject},
			}},
			{"users.roles:read", "users", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "get", Object: roleBindingsObject},
			}},
			// add maps to both create and update on rolebindings.
			{"users.roles:add", "permissions", "delegate", []*openfgav1.TupleKey{
				{User: subject, Relation: "create", Object: roleBindingsObject},
				{User: subject, Relation: "update", Object: roleBindingsObject},
			}},
			{"users.roles:remove", "permissions", "delegate", []*openfgav1.TupleKey{
				{User: subject, Relation: "delete", Object: roleBindingsObject},
			}},
		}

		for _, tc := range cases {
			t.Run(tc.action, func(t *testing.T) {
				tuples := UserManagementToTuples(subject, RolePermission{
					Action: tc.action, Kind: tc.kind, Identifier: tc.identifier,
				})
				require.ElementsMatch(t, tupleKeyStrings(tc.expected), tupleKeyStrings(tuples))
			})
		}
	})

	t.Run("drops non-all scopes (except create)", func(t *testing.T) {
		require.Nil(t, UserManagementToTuples(subject, RolePermission{
			Action: "org.users:write", Kind: "users", Identifier: "1",
		}))
		require.Nil(t, UserManagementToTuples(subject, RolePermission{
			Action: "users.roles:read", Kind: "users", Identifier: "5",
		}))
	})

	t.Run("drops actions with no iam verb", func(t *testing.T) {
		for _, action := range []string{"users:enable", "users:disable", "users:logout", "users.authtoken:read", "users.password:write", "users.quotas:write"} {
			require.Nil(t, UserManagementToTuples(subject, RolePermission{
				Action: action, Kind: "global.users", Identifier: "*",
			}), "action %q should not translate", action)
		}
	})
}

func TestTeamManagementToTuples(t *testing.T) {
	const subject = "role:role-1#assignee"
	const teamsObject = "group_resource:iam.grafana.app/teams"
	const roleBindingsObject = "group_resource:iam.grafana.app/rolebindings"

	t.Run("maps each action to its tuples under an all-scope", func(t *testing.T) {
		cases := []struct {
			action     string
			kind       string
			identifier string
			expected   []*openfgav1.TupleKey
		}{
			// teams:create carries no scope (skipScope) and always translates.
			{"teams:create", "", "", []*openfgav1.TupleKey{
				{User: subject, Relation: "create", Object: teamsObject},
			}},
			{"teams:read", "teams", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "get", Object: teamsObject},
			}},
			{"teams:write", "teams", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "update", Object: teamsObject},
			}},
			{"teams:delete", "teams", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "delete", Object: teamsObject},
			}},
			{"teams.permissions:read", "teams", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "get_permissions", Object: teamsObject},
			}},
			{"teams.permissions:write", "teams", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "set_permissions", Object: teamsObject},
			}},
			// teams.roles:* gate rolebindings (same object as users.roles:*).
			{"teams.roles:read", "teams", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "get", Object: roleBindingsObject},
			}},
			{"teams.roles:add", "permissions", "delegate", []*openfgav1.TupleKey{
				{User: subject, Relation: "create", Object: roleBindingsObject},
				{User: subject, Relation: "update", Object: roleBindingsObject},
			}},
			{"teams.roles:remove", "permissions", "delegate", []*openfgav1.TupleKey{
				{User: subject, Relation: "delete", Object: roleBindingsObject},
			}},
		}

		for _, tc := range cases {
			t.Run(tc.action, func(t *testing.T) {
				tuples := TeamManagementToTuples(subject, RolePermission{
					Action: tc.action, Kind: tc.kind, Identifier: tc.identifier,
				})
				require.ElementsMatch(t, tupleKeyStrings(tc.expected), tupleKeyStrings(tuples))
			})
		}
	})

	t.Run("drops specific-instance scopes (except create)", func(t *testing.T) {
		require.Nil(t, TeamManagementToTuples(subject, RolePermission{Action: "teams:read", Kind: "teams", Identifier: "5"}))
		require.Nil(t, TeamManagementToTuples(subject, RolePermission{Action: "teams.roles:add", Kind: "teams", Identifier: "5"}))

		require.ElementsMatch(t,
			tupleKeyStrings([]*openfgav1.TupleKey{{User: subject, Relation: "create", Object: teamsObject}}),
			tupleKeyStrings(TeamManagementToTuples(subject, RolePermission{Action: "teams:create", Kind: "teams", Identifier: "5"})),
		)
	})

	t.Run("returns nil for non-team actions", func(t *testing.T) {
		require.Nil(t, TeamManagementToTuples(subject, RolePermission{Action: "users:read", Kind: "users", Identifier: "*"}))
		require.Nil(t, TeamManagementToTuples(subject, RolePermission{Action: "teams:enable", Kind: "teams", Identifier: "*"}))
	})

	t.Run("emits per-instance tuples for uid scopes on the teams resource", func(t *testing.T) {
		cases := []struct {
			action   string
			expected []*openfgav1.TupleKey
		}{
			{"teams:read", []*openfgav1.TupleKey{{User: subject, Relation: "get", Object: "team:t1"}}},
			{"teams:write", []*openfgav1.TupleKey{{User: subject, Relation: "update", Object: "team:t1"}}},
			{"teams:delete", []*openfgav1.TupleKey{{User: subject, Relation: "delete", Object: "team:t1"}}},
			{"teams.permissions:read", []*openfgav1.TupleKey{{User: subject, Relation: "get_permissions", Object: "team:t1"}}},
			{"teams.permissions:write", []*openfgav1.TupleKey{{User: subject, Relation: "set_permissions", Object: "team:t1"}}},
		}
		for _, tc := range cases {
			t.Run(tc.action, func(t *testing.T) {
				tuples := TeamManagementToTuples(subject, RolePermission{
					Action: tc.action, Kind: "teams", Attribute: "uid", Identifier: "t1",
				})
				require.ElementsMatch(t, tupleKeyStrings(tc.expected), tupleKeyStrings(tuples))
			})
		}
	})

	t.Run("drops uid scopes for rolebindings-mapped team actions", func(t *testing.T) {
		// teams.roles:* gate the wildcard-only rolebindings group_resource; a specific
		// team uid has no per-instance representation there.
		require.Nil(t, TeamManagementToTuples(subject, RolePermission{Action: "teams.roles:read", Kind: "teams", Attribute: "uid", Identifier: "t1"}))
		require.Nil(t, TeamManagementToTuples(subject, RolePermission{Action: "teams.roles:add", Kind: "teams", Attribute: "uid", Identifier: "t1"}))
	})

	t.Run("drops id-based instance scopes (unresolved to uid)", func(t *testing.T) {
		// Attribute "id" means the scope wasn't resolved to a uid; dropped to avoid
		// emitting team:<numeric-id>, which would be a wrong (non-existent) object.
		require.Nil(t, TeamManagementToTuples(subject, RolePermission{Action: "teams:read", Kind: "teams", Attribute: "id", Identifier: "5"}))
		require.Nil(t, TeamManagementToTuples(subject, RolePermission{Action: "teams.permissions:write", Kind: "teams", Attribute: "id", Identifier: "5"}))
	})
}

// tupleKeyStrings returns the prototext (`.String()`) form of each tuple.
// Comparing tuples by their textual form sidesteps proto-internal state
// caches that confuse reflect-based comparators like require.ElementsMatch,
// and automatically picks up any new public field added to TupleKey upstream.
func tupleKeyStrings(tuples []*openfgav1.TupleKey) []string {
	out := make([]string, len(tuples))
	for i, t := range tuples {
		out[i] = t.String()
	}
	return out
}
