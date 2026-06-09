package ossaccesscontrol

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

// These tests lock in the templated reader/writer permission-management roles
// (fixed:{resource}.permissions:reader and :writer) that the GlobalRole seeder
// aggregates via AllFixedRoleRegistrations. They must stay in sync with the
// resourcepermissions.Options declared in the corresponding Provide* functions.
func TestResourcePermissionsRoleRegistrations(t *testing.T) {
	tests := []struct {
		name          string
		got           []accesscontrol.RoleRegistration
		readerName    string
		writerName    string
		group         string
		readerActions []string
		writerActions []string
		scope         string
	}{
		{
			name:          "folders",
			got:           FolderPermissionsRoleRegistrations(),
			readerName:    "fixed:folders.permissions:reader",
			writerName:    "fixed:folders.permissions:writer",
			group:         "Folders",
			readerActions: []string{"folders.permissions:read"},
			writerActions: []string{"folders.permissions:read", "folders.permissions:write"},
			scope:         "folders:*",
		},
		{
			name:          "dashboards",
			got:           DashboardPermissionsRoleRegistrations(),
			readerName:    "fixed:dashboards.permissions:reader",
			writerName:    "fixed:dashboards.permissions:writer",
			group:         "Dashboards",
			readerActions: []string{"dashboards.permissions:read"},
			writerActions: []string{"dashboards.permissions:read", "dashboards.permissions:write"},
			scope:         "dashboards:*",
		},
		{
			name:          "teams",
			got:           TeamPermissionsRoleRegistrations(),
			readerName:    "fixed:teams.permissions:reader",
			writerName:    "fixed:teams.permissions:writer",
			group:         "Teams",
			readerActions: []string{"teams.permissions:read"},
			writerActions: []string{"teams.permissions:read", "teams.permissions:write"},
			scope:         "teams:*",
		},
		{
			name:          "service accounts",
			got:           ServiceAccountPermissionsRoleRegistrations(),
			readerName:    "fixed:serviceaccounts.permissions:reader",
			writerName:    "fixed:serviceaccounts.permissions:writer",
			group:         "Service accounts",
			readerActions: []string{"serviceaccounts.permissions:read"},
			writerActions: []string{"serviceaccounts.permissions:read", "serviceaccounts.permissions:write"},
			scope:         "serviceaccounts:*",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Len(t, tt.got, 2, "expected a reader and a writer registration")

			reader, writer := tt.got[0], tt.got[1]

			assert.Equal(t, tt.readerName, reader.Role.Name)
			assert.Equal(t, tt.writerName, writer.Role.Name)
			assert.Equal(t, tt.group, reader.Role.Group)
			assert.Equal(t, tt.group, writer.Role.Group)
			assert.Equal(t, []string{string(org.RoleAdmin)}, reader.Grants)
			assert.Equal(t, []string{string(org.RoleAdmin)}, writer.Grants)

			assert.Equal(t, tt.readerActions, actionsOf(reader, tt.scope))
			assert.Equal(t, tt.writerActions, actionsOf(writer, tt.scope))
		})
	}
}

func TestAlertingPermissionsRoleRegistrations(t *testing.T) {
	t.Run("receivers use the legacy action format", func(t *testing.T) {
		regs := ReceiverPermissionsRoleRegistrations()
		require.Len(t, regs, 2)
		assert.Equal(t, "fixed:receivers.permissions:reader", regs[0].Role.Name)
		assert.Equal(t, "fixed:receivers.permissions:writer", regs[1].Role.Name)
		assert.Equal(t, []string{"receivers.permissions:read"}, actionsOf(regs[0], "receivers:*"))
	})

	t.Run("routes use the k8s action format", func(t *testing.T) {
		regs := RoutePermissionsRoleRegistrations()
		require.Len(t, regs, 2)
		// K8sActionFormat -> fixed:{APIGroup}:{Resource}.permissions:{suffix}
		assert.Contains(t, regs[0].Role.Name, ".permissions:reader")
		assert.Contains(t, regs[1].Role.Name, ".permissions:writer")
		require.Len(t, regs[0].Role.Permissions, 1)
		assert.Contains(t, regs[0].Role.Permissions[0].Action, ":get_permissions")
	})
}

// actionsOf returns the actions in a registration that target the given scope,
// preserving order.
func actionsOf(reg accesscontrol.RoleRegistration, scope string) []string {
	actions := make([]string, 0, len(reg.Role.Permissions))
	for _, p := range reg.Role.Permissions {
		if p.Scope == scope {
			actions = append(actions, p.Action)
		}
	}
	return actions
}
