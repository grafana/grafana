package store

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type staticRoleService struct {
	accesscontrol.Service
	roles map[string]*accesscontrol.RoleDTO
}

func (s *staticRoleService) GetStaticRoles(context.Context) map[string]*accesscontrol.RoleDTO {
	return s.roles
}

func TestStaticPermissionStoreGetUserPermissions(t *testing.T) {
	permissions := []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "folders:read", Scope: "folders:*"},
	}
	store := NewStaticPermissionStore(&staticRoleService{
		roles: map[string]*accesscontrol.RoleDTO{
			"Viewer": {Permissions: permissions},
		},
	})

	t.Run("returns permissions for the requested action", func(t *testing.T) {
		got, err := store.GetUserPermissions(t.Context(), types.NamespaceInfo{}, PermissionsQuery{
			Role:   "Viewer",
			Action: "dashboards:read",
		})

		require.NoError(t, err)
		require.Equal(t, permissions[:1], got)
	})

	t.Run("returns permissions for every action when action is empty", func(t *testing.T) {
		got, err := store.GetUserPermissions(t.Context(), types.NamespaceInfo{}, PermissionsQuery{
			Role: "Viewer",
		})

		require.NoError(t, err)
		require.Equal(t, permissions, got)
	})
}
