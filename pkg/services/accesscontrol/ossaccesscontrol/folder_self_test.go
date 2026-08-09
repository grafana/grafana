package ossaccesscontrol

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/folder"
)

// TestFolderSelfReadRoleRegistration is a spike test for identity-access-team#2285, Phase 1.
// It verifies the production registration data (not a copy of it) satisfies the two properties
// the design depends on:
//  1. folders.self:read is never bundled into a role actually granted to a built-in org role
//     (Viewer/Editor/Admin/Grafana Admin) -- it must only ever be reachable via an explicit
//     custom-role assignment.
//  2. Declaring it (mirroring what Service.DeclareFixedRoles does: validate + RegisterPermission)
//     is enough to make folders.self:read a recognised action for custom-role validation.
func TestFolderSelfReadRoleRegistration(t *testing.T) {
	reg := FolderSelfReadRoleRegistration()

	t.Run("is a well-formed fixed role", func(t *testing.T) {
		require.NoError(t, accesscontrol.ValidateFixedRole(reg.Role))
		require.NoError(t, accesscontrol.ValidateBuiltInRoles(reg.Grants))
	})

	t.Run("is not granted to any built-in role", func(t *testing.T) {
		assert.Empty(t, reg.Grants, "folders.self:read must only be reachable via an explicit custom-role assignment, never a default grant")
	})

	t.Run("folders.self:read is not bundled into any of the Viewer/Editor/Admin action sets", func(t *testing.T) {
		assert.NotContains(t, FolderViewActions, folder.ActionFoldersReadSelf)
		assert.NotContains(t, FolderEditActions, folder.ActionFoldersReadSelf)
		assert.NotContains(t, FolderAdminActions, folder.ActionFoldersReadSelf)
	})

	t.Run("declaring it registers folders.self:read for custom-role validation", func(t *testing.T) {
		pr := permreg.ProvidePermissionRegistry()
		for _, p := range reg.Role.Permissions {
			require.NoError(t, pr.RegisterPermission(p.Action, p.Scope))
		}

		assert.NoError(t, pr.IsPermissionValid(folder.ActionFoldersReadSelf, "folders:uid:AABBCC"))
		// Scope must still be tied to a specific folder, not left completely unchecked -- a
		// mistyped action name should not silently validate.
		assert.Error(t, pr.IsPermissionValid("folders.self:write", "folders:uid:AABBCC"))
	})
}
