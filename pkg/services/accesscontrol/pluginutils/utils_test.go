package pluginutils

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestToRegistrations(t *testing.T) {
	tests := []struct {
		name string
		regs []plugins.RoleRegistration
		want []ac.RoleRegistration
	}{
		{
			name: "no registration",
			regs: nil,
			want: []ac.RoleRegistration{},
		},
		{
			name: "registration gets converted successfully",
			regs: []plugins.RoleRegistration{
				{
					Role: plugins.Role{
						Name:        "Tester",
						Description: "Test",
						Permissions: []plugins.Permission{
							{Action: "test:action"},
							{Action: "test:action", Scope: "test:scope"},
						},
					},
					Grants: []string{"Admin", "Editor"},
				},
				{
					Role: plugins.Role{
						Name:        "Admin Validator",
						Permissions: []plugins.Permission{},
					},
				},
			},
			want: []ac.RoleRegistration{
				{
					Role: ac.RoleDTO{
						Version:     1,
						Name:        ac.PluginRolePrefix + "plugin-id:tester",
						DisplayName: "Tester",
						Description: "Test",
						Group:       "Plugin Name",
						Permissions: []ac.Permission{
							{Action: "test:action"},
							{Action: "test:action", Scope: "test:scope"},
						},
						OrgID: ac.GlobalOrgID,
					},
					Grants: []string{"Admin", "Editor"},
				},
				{
					Role: ac.RoleDTO{
						Version:     1,
						Name:        ac.PluginRolePrefix + "plugin-id:admin-validator",
						DisplayName: "Admin Validator",
						Group:       "Plugin Name",
						Permissions: []ac.Permission{},
						OrgID:       ac.GlobalOrgID,
					},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ToRegistrations("plugin-id", "Plugin Name", tt.regs)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestValidatePluginRole(t *testing.T) {
	tests := []struct {
		name     string
		pluginID string
		role     ac.RoleDTO
		wantErr  error
	}{
		{
			name:     "empty display name",
			pluginID: "test-app",
			role:     ac.RoleDTO{DisplayName: ""},
			wantErr:  &ac.ErrorInvalidRole{},
		},
		{
			name:     "empty",
			pluginID: "",
			role:     ac.RoleDTO{Name: "plugins::reader", DisplayName: "Reader"},
			wantErr:  ac.ErrPluginIDRequired,
		},
		{
			name:     "invalid name",
			pluginID: "test-app",
			role:     ac.RoleDTO{Name: "test-app:reader", DisplayName: "Reader"},
			wantErr:  &ac.ErrorInvalidRole{},
		},
		{
			name:     "invalid id in name",
			pluginID: "test-app",
			role:     ac.RoleDTO{Name: "plugins:test-app2:reader", DisplayName: "Reader"},
			wantErr:  &ac.ErrorInvalidRole{},
		},
		{
			name:     "valid name",
			pluginID: "test-app",
			role:     ac.RoleDTO{Name: "plugins:test-app:reader", DisplayName: "Reader"},
		},
		{
			name:     "invalid permission",
			pluginID: "test-app",
			role: ac.RoleDTO{
				Name:        "plugins:test-app:reader",
				DisplayName: "Reader",
				Permissions: []ac.Permission{{Action: "invalidtest-app:read"}},
			},
			wantErr: &ac.ErrorInvalidRole{},
		},
		{
			name:     "valid permissions",
			pluginID: "test-app",
			role: ac.RoleDTO{
				Name:        "plugins:test-app:reader",
				DisplayName: "Reader",
				Permissions: []ac.Permission{
					{Action: "plugins.app:access", Scope: "plugins:id:test-app"},
					{Action: "test-app:read"},
					{Action: "test-app.resources:read"},
				},
			},
		},
		{
			name:     "invalid permission targets other plugin",
			pluginID: "test-app",
			role: ac.RoleDTO{
				Name:        "plugins:test-app:reader",
				DisplayName: "Reader",
				Permissions: []ac.Permission{
					{Action: "plugins.app:access", Scope: "plugins:id:other-app"},
				},
			},
			wantErr: &ac.ErrorInvalidRole{},
		},
		{
			name:     "valid core permission targets plugin",
			pluginID: "test-app",
			role: ac.RoleDTO{
				Name:        "plugins:test-app:reader",
				DisplayName: "Plugin Folder Reader",
				Permissions: []ac.Permission{
					{Action: "folders:read", Scope: "folders:uid:test-app"},
				},
			},
		},
		{
			name:     "invalid core permission targets other plugin",
			pluginID: "test-app",
			role: ac.RoleDTO{
				Name:        "plugins:test-app:reader",
				DisplayName: "Plugin Folder Reader",
				Permissions: []ac.Permission{
					{Action: "folders:read", Scope: "folders:uid:other-app"},
				},
			},
			wantErr: &ac.ErrorInvalidRole{},
		},
		{
			name:     "valid core plugin permission targets plugin",
			pluginID: "test-app",
			role: ac.RoleDTO{
				Name:        "plugins:test-app:reader",
				DisplayName: "Plugin Configurator",
				Permissions: []ac.Permission{
					{Action: "plugins:write", Scope: "plugins:id:test-app"},
				},
			},
		},
		{
			name:     "invalid core plugin permission targets other plugin",
			pluginID: "test-app",
			role: ac.RoleDTO{
				Name:        "plugins:test-app:reader",
				DisplayName: "Plugin Configurator",
				Permissions: []ac.Permission{
					{Action: "plugins:write", Scope: "plugins:id:other-app"},
				},
			},
			wantErr: &ac.ErrorInvalidRole{},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePluginRole(tt.pluginID, tt.role)
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}
}
