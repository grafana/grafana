package test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
)

func ProvidePermissionRegistry(t *testing.T) permreg.PermissionRegistry {
	permReg := permreg.ProvidePermissionRegistry()
	// Test core permissions
	err := permReg.RegisterPermission("datasources:read", "datasources:uid:")
	require.NoError(t, err)
	err = permReg.RegisterPermission("dashboards:read", "dashboards:uid:")
	require.NoError(t, err)
	err = permReg.RegisterPermission("dashboards:read", "folders:uid:")
	require.NoError(t, err)
	err = permReg.RegisterPermission("folders:read", "folders:uid:")
	require.NoError(t, err)
	// Test plugins permissions
	err = permReg.RegisterPermission("plugins.app:access", "plugins:id:")
	require.NoError(t, err)
	// App
	err = permReg.RegisterPermission("test-app:read", "")
	require.NoError(t, err)
	err = permReg.RegisterPermission("test-app.settings:read", "")
	require.NoError(t, err)
	err = permReg.RegisterPermission("test-app.projects:read", "")
	require.NoError(t, err)
	// App 1
	err = permReg.RegisterPermission("test-app1.catalog:read", "")
	require.NoError(t, err)
	err = permReg.RegisterPermission("test-app1.announcements:read", "")
	require.NoError(t, err)
	return permReg
}
