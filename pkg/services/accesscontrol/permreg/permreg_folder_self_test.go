package permreg

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestPermissionRegistry_FolderSelfReadRegistrationGap is a spike test for the
// folders.self:read design (identity-access-team#2285, Phase 1, open question #3: "does the role
// write path accept the new action end to end?").
//
// folders.self:read is deliberately NOT part of FolderViewActions/FolderEditActions/
// FolderAdminActions (see pkg/services/accesscontrol/ossaccesscontrol/folder.go) -- bundling it
// there would grant it to every Viewer by default, which defeats the point of a self-only,
// individually-assignable action. But DeclareFixedRoles only calls RegisterPermission for
// actions that appear in a *declared* fixed role's permission list. An action that is never
// declared by any fixed role is never registered, so custom-role validation
// (ValidateProvidedPermissions, enterprise-only, gated by cfg.RBAC.PermissionValidationEnabled)
// rejects it with ErrUnknownAction.
//
// This demonstrates the gap empirically, and the minimal fix: registering the action (with its
// scope prefix) via a role declaration that is never granted to any built-in role, so the
// registry knows about it without bundling it into Viewer/Editor/Admin.
func TestPermissionRegistry_FolderSelfReadRegistrationGap(t *testing.T) {
	t.Run("unregistered folders.self:read is rejected as an unknown action", func(t *testing.T) {
		pr := newPermissionRegistry()
		// Simulates today's state: only the bundled folder actions get registered by
		// DeclareFixedRoles; folders.self:read is not one of them.
		require.NoError(t, pr.RegisterPermission("folders:read", "folders:uid:"))

		err := pr.IsPermissionValid("folders.self:read", "folders:uid:AABBCC")
		require.Error(t, err, "folders.self:read must be registered somewhere or custom-role creation will reject it")
		assert.ErrorIs(t, err, ErrUnknownAction("folders.self:read"))
	})

	t.Run("registering folders.self:read directly (without granting it to any role) fixes validation", func(t *testing.T) {
		pr := newPermissionRegistry()
		require.NoError(t, pr.RegisterPermission("folders:read", "folders:uid:"))

		// The fix: a RegisterPermission call for folders.self:read, e.g. via a hidden
		// accesscontrol.RoleRegistration with Grants: []string{} (never assigned to Viewer/
		// Editor/Admin/Grafana Admin), so the *only* way a user gets this action is an explicit
		// custom-role assignment naming a specific folder.
		require.NoError(t, pr.RegisterPermission("folders.self:read", "folders:uid:"))

		assert.NoError(t, pr.IsPermissionValid("folders.self:read", "folders:uid:AABBCC"))
	})
}
