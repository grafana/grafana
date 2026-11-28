package seeding

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestNeedsRoleUpdate(t *testing.T) {
	base := accesscontrol.RoleDTO{
		Name:        "role:test",
		DisplayName: "Test role",
		Description: "A test role",
		Group:       "test",
		Hidden:      true,
	}

	tests := []struct {
		name     string
		existing *accesscontrol.RoleDTO
		wanted   accesscontrol.RoleDTO
		want     bool
	}{
		{name: "nil existing role", wanted: base, want: true},
		{name: "same role", existing: &base, wanted: base},
		{name: "name mismatch", existing: &base, wanted: accesscontrol.RoleDTO{Name: "role:other"}},
		{name: "display name changed", existing: &base, wanted: withRoleChange(base, func(role *accesscontrol.RoleDTO) { role.DisplayName = "Changed" }), want: true},
		{name: "description changed", existing: &base, wanted: withRoleChange(base, func(role *accesscontrol.RoleDTO) { role.Description = "Changed" }), want: true},
		{name: "group changed", existing: &base, wanted: withRoleChange(base, func(role *accesscontrol.RoleDTO) { role.Group = "changed" }), want: true},
		{name: "hidden changed", existing: &base, wanted: withRoleChange(base, func(role *accesscontrol.RoleDTO) { role.Hidden = false }), want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := NeedsRoleUpdate(tt.existing, tt.wanted); got != tt.want {
				t.Fatalf("NeedsRoleUpdate() = %t, want %t", got, tt.want)
			}
		})
	}
}

func TestNeedsPermissionsUpdate(t *testing.T) {
	tests := []struct {
		name                string
		existingPermissions []accesscontrol.Permission
		wantedPermissions   []accesscontrol.Permission
		nilExisting         bool
		want                bool
	}{
		{name: "nil existing role", nilExisting: true, wantedPermissions: []accesscontrol.Permission{}, want: true},
		{name: "order ignored", existingPermissions: []accesscontrol.Permission{{Action: "read", Scope: "folder:1"}, {Action: "write", Scope: "folder:2"}}, wantedPermissions: []accesscontrol.Permission{{Action: "write", Scope: "folder:2"}, {Action: "read", Scope: "folder:1"}}},
		{name: "duplicates ignored", existingPermissions: []accesscontrol.Permission{{Action: "read", Scope: "folder:1"}, {Action: "read", Scope: "folder:1"}}, wantedPermissions: []accesscontrol.Permission{{Action: "read", Scope: "folder:1"}}},
		{name: "equal length duplicate differs", existingPermissions: []accesscontrol.Permission{{Action: "read", Scope: "folder:1"}, {Action: "write", Scope: "folder:1"}}, wantedPermissions: []accesscontrol.Permission{{Action: "read", Scope: "folder:1"}, {Action: "read", Scope: "folder:1"}}, want: true},
		{name: "datasource type ignored", existingPermissions: []accesscontrol.Permission{{Action: "read", Scope: "datasource:1", DatasourceType: "postgres"}}, wantedPermissions: []accesscontrol.Permission{{Action: "read", Scope: "datasource:1", DatasourceType: "mysql"}}},
		{name: "different action", existingPermissions: []accesscontrol.Permission{{Action: "read", Scope: "folder:1"}}, wantedPermissions: []accesscontrol.Permission{{Action: "write", Scope: "folder:1"}}, want: true},
		{name: "different scope", existingPermissions: []accesscontrol.Permission{{Action: "read", Scope: "folder:1"}}, wantedPermissions: []accesscontrol.Permission{{Action: "read", Scope: "folder:2"}}, want: true},
		{name: "additional permission", existingPermissions: []accesscontrol.Permission{{Action: "read", Scope: "folder:1"}}, wantedPermissions: []accesscontrol.Permission{{Action: "read", Scope: "folder:1"}, {Action: "write", Scope: "folder:1"}}, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var existing *accesscontrol.RoleDTO
			if !tt.nilExisting {
				existing = &accesscontrol.RoleDTO{Permissions: tt.existingPermissions}
			}
			if got := NeedsPermissionsUpdate(existing, accesscontrol.RoleDTO{Permissions: tt.wantedPermissions}); got != tt.want {
				t.Fatalf("NeedsPermissionsUpdate() = %t, want %t", got, tt.want)
			}
		})
	}
}

func withRoleChange(role accesscontrol.RoleDTO, change func(*accesscontrol.RoleDTO)) accesscontrol.RoleDTO {
	change(&role)
	return role
}
