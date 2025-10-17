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
}

