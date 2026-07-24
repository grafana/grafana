package zanzana

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFallbackPermissionProjection(t *testing.T) {
	t.Run("native emits only resource tuples", func(t *testing.T) {
		translation, err := TranslatePermission("role:test#assignee", RolePermission{
			Action: "folders:read", Scope: "folders:uid:one", Kind: "folders", Attribute: "uid", Identifier: "one",
		})
		require.NoError(t, err)
		require.Equal(t, Native, translation.Kind)
		require.Len(t, translation.Tuples, 1)
		require.Equal(t, "folder:one", translation.Tuples[0].Object)
	})

	t.Run("fallback emits action marker and exact permission", func(t *testing.T) {
		translation, err := TranslatePermission("role:test#assignee", RolePermission{
			Action: "plugins.app:read", Scope: "plugins:id:one", Kind: "plugins", Attribute: "id", Identifier: "one",
		})
		require.NoError(t, err)
		require.Equal(t, Fallback, translation.Kind)
		require.ElementsMatch(t, []string{
			FallbackActionObject("plugins.app:read"),
			FallbackPermissionObject("plugins.app:read", "plugins:id:one"),
		}, []string{translation.Tuples[0].Object, translation.Tuples[1].Object})
	})

	t.Run("scopeless fallback emits only action marker", func(t *testing.T) {
		translation, err := TranslatePermission("role:test#assignee", RolePermission{Action: "plugins.app:create"})
		require.NoError(t, err)
		require.Equal(t, Fallback, translation.Kind)
		require.Len(t, translation.Tuples, 1)
		require.Equal(t, FallbackActionObject("plugins.app:create"), translation.Tuples[0].Object)
	})

	t.Run("invalid permissions fail projection", func(t *testing.T) {
		translation, err := TranslatePermission("role:test#assignee", RolePermission{Action: "plugins.app:read", Scope: "plugins:*:one"})
		require.Error(t, err)
		require.Equal(t, Invalid, translation.Kind)
	})

	t.Run("duplicate fallback permissions are deduplicated", func(t *testing.T) {
		permission := RolePermission{Action: "plugins.app:read", Scope: "plugins:id:one", Kind: "plugins", Attribute: "id", Identifier: "one"}
		tuples, err := ProjectRolePermissionsToTuples("test", []RolePermission{permission, permission})
		require.NoError(t, err)
		require.Len(t, tuples, 2)
	})
}

func TestFallbackScopeCandidates(t *testing.T) {
	candidates, err := FallbackScopeCandidates("resources:uid:parent/child")
	require.NoError(t, err)
	require.ElementsMatch(t, []string{
		"resources:uid:parent/child",
		"*",
		"resources:*",
		"resources:uid:*",
		"resources:uid:parent/*",
	}, candidates)

	candidates, err = FallbackScopeCandidates("resources:uid:*")
	require.NoError(t, err)
	require.ElementsMatch(t, []string{"*", "resources:*", "resources:uid:*"}, candidates)
}

func TestFallbackIDsAreCollisionSafe(t *testing.T) {
	require.NotEqual(t,
		FallbackPermissionObject("a:b", "c"),
		FallbackPermissionObject("a", "b:c"),
	)
	require.Contains(t, FallbackActionObject("a:b"), "rbac_action:v1.")

	action, err := DecodeFallbackActionObject(FallbackActionObject("a:b"))
	require.NoError(t, err)
	require.Equal(t, "a:b", action)
	action, scope, err := DecodeFallbackPermissionObject(FallbackPermissionObject("a:b", "c:d/e"))
	require.NoError(t, err)
	require.Equal(t, "a:b", action)
	require.Equal(t, "c:d/e", scope)
}
