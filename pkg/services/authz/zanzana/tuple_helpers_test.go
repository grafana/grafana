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

	t.Run("should reconcile team-management permissions", func(t *testing.T) {
		// A role that can fully manage teams: read/write/create/delete plus team
		// permissions. Each maps to a single relation on the iam.grafana.app/teams
		// group_resource.
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

	t.Run("should reconcile team role-assignment permissions to the rolebindings teams subresource", func(t *testing.T) {
		// teams.roles:* gate team role-bindings, which are addressed as the
		// "teams" subresource of rolebindings so they stay distinct from user
		// role-bindings (plain rolebindings).
		permissions := []RolePermission{
			{Action: "teams.roles:read", Kind: "teams", Identifier: "*"},
			{Action: "teams.roles:add", Kind: "permissions", Identifier: "delegate"},
			{Action: "teams.roles:remove", Kind: "permissions", Identifier: "delegate"},
		}

		tuples, err := ConvertRolePermissionsToTuples("role-team-roles", permissions)
		require.NoError(t, err)

		require.ElementsMatch(t, tupleKeyStrings([]*openfgav1.TupleKey{
			{User: "role:role-team-roles#assignee", Relation: "get", Object: "group_resource:iam.grafana.app/rolebindings/teams"},
			{User: "role:role-team-roles#assignee", Relation: "create", Object: "group_resource:iam.grafana.app/rolebindings/teams"},
			{User: "role:role-team-roles#assignee", Relation: "update", Object: "group_resource:iam.grafana.app/rolebindings/teams"},
			{User: "role:role-team-roles#assignee", Relation: "delete", Object: "group_resource:iam.grafana.app/rolebindings/teams"},
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

func TestTeamManagementToTuples(t *testing.T) {
	const subject = "role:role-1#assignee"
	const teamsObject = "group_resource:iam.grafana.app/teams"
	const teamRoleBindingsObject = "group_resource:iam.grafana.app/rolebindings/teams"

	t.Run("maps each action to its tuples under an all-scope", func(t *testing.T) {
		cases := []struct {
			action     string
			kind       string
			identifier string
			expected   []*openfgav1.TupleKey
		}{
			{"teams:read", "teams", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "get", Object: teamsObject},
			}},
			{"teams:write", "teams", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "update", Object: teamsObject},
			}},
			{"teams:create", "", "", []*openfgav1.TupleKey{
				{User: subject, Relation: "create", Object: teamsObject},
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
			{"teams.roles:read", "teams", "*", []*openfgav1.TupleKey{
				{User: subject, Relation: "get", Object: teamRoleBindingsObject},
			}},
			{"teams.roles:add", "permissions", "delegate", []*openfgav1.TupleKey{
				{User: subject, Relation: "create", Object: teamRoleBindingsObject},
				{User: subject, Relation: "update", Object: teamRoleBindingsObject},
			}},
			{"teams.roles:remove", "permissions", "delegate", []*openfgav1.TupleKey{
				{User: subject, Relation: "delete", Object: teamRoleBindingsObject},
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

		// create is unscoped and always translates.
		require.ElementsMatch(t,
			tupleKeyStrings([]*openfgav1.TupleKey{{User: subject, Relation: "create", Object: teamsObject}}),
			tupleKeyStrings(TeamManagementToTuples(subject, RolePermission{Action: "teams:create", Kind: "teams", Identifier: "5"})),
		)
	})

	t.Run("returns nil for non-team actions", func(t *testing.T) {
		require.Nil(t, TeamManagementToTuples(subject, RolePermission{Action: "users:read", Kind: "users", Identifier: "*"}))
		require.Nil(t, TeamManagementToTuples(subject, RolePermission{Action: "teams:enable", Kind: "teams", Identifier: "*"}))
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
