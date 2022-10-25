package accesscontrol

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConcatPermissions(t *testing.T) {
	perms1 := []Permission{
		{
			Action: "test",
			Scope:  "test:*",
		},
		{
			Action: "test1",
			Scope:  "test1:*",
		},
	}
	perms2 := []Permission{
		{
			Action: "test1",
			Scope:  "*",
		},
	}

	expected := []Permission{
		{
			Action: "test",
			Scope:  "test:*",
		},
		{
			Action: "test1",
			Scope:  "test1:*",
		},
		{
			Action: "test1",
			Scope:  "*",
		},
	}

	perms := ConcatPermissions(perms1, perms2)
	assert.ElementsMatch(t, perms, expected)
}

func TestValidatePluginRole(t *testing.T) {
	tests := []struct {
		name     string
		pluginID string
		role     RoleDTO
		wantErr  error
	}{
		{
			name:     "empty",
			pluginID: "",
			role:     RoleDTO{Name: "plugins.app::"},
			wantErr:  ErrPluginIDRequired,
		},
		{
			name:     "invalid name",
			pluginID: "test-app",
			role:     RoleDTO{Name: "test-app:reader"},
			wantErr:  &ErrorInvalidRole{},
		},
		{
			name:     "invalid id in name",
			pluginID: "test-app",
			role:     RoleDTO{Name: "plugins.app:test-app2:reader"},
			wantErr:  &ErrorInvalidRole{},
		},
		{
			name:     "valid name",
			pluginID: "test-app",
			role:     RoleDTO{Name: "plugins.app:test-app:reader"},
		},
		{
			name:     "invalid permission",
			pluginID: "test-app",
			role: RoleDTO{
				Name:        "plugins.app:test-app:reader",
				Permissions: []Permission{{Action: "invalidtest-app:read"}},
			},
			wantErr: &ErrorInvalidRole{},
		},
		{
			name:     "valid permissions",
			pluginID: "test-app",
			role: RoleDTO{
				Name: "plugins.app:test-app:reader",
				Permissions: []Permission{
					{Action: "plugins.app:read"},
					{Action: "test-app:read"},
					{Action: "test-app.resources:read"},
				},
			},
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
