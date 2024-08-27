package test

import "github.com/grafana/grafana/pkg/services/accesscontrol/permreg"

func ProvidePermissionRegistry() permreg.PermissionRegistry {
	permReg := permreg.ProvidePermissionRegistry()
	// Test core permissions
	permReg.RegisterPermission("datasources:read", "datasources:uid:")
	permReg.RegisterPermission("dashboards:read", "dashboards:uid:")
	permReg.RegisterPermission("dashboards:read", "folders:uid:")
	permReg.RegisterPermission("folders:read", "folders:uid:")
	// Test plugins permissions
	permReg.RegisterPermission("plugins.app:access", "plugins:id:")
	// App
	permReg.RegisterPermission("test-app:read", "")
	permReg.RegisterPermission("test-app.settings:read", "")
	permReg.RegisterPermission("test-app.projects:read", "")
	// App 1
	permReg.RegisterPermission("test-app1.catalog:read", "")
	permReg.RegisterPermission("test-app1.announcements:read", "")
	return permReg
}
