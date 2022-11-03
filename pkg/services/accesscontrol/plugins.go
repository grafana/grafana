package accesscontrol

import (
	"strings"
)

// ValidatePluginPermissions errors when a permission does not match expected pattern for plugins
func ValidatePluginPermissions(pluginID string, permissions []Permission) error {
	for i := range permissions {
		if !strings.HasPrefix(permissions[i].Action, AppPluginRolePrefix) &&
			!strings.HasPrefix(permissions[i].Action, pluginID+":") &&
			!strings.HasPrefix(permissions[i].Action, pluginID+".") {
			return &ErrorActionPrefixMissing{Action: permissions[i].Action,
				Prefixes: []string{AppPluginRolePrefix, pluginID + ":", pluginID + "."}}
		}
	}

	return nil
}

// ValidatePluginRole errors when a plugin role does not match expected pattern
// or doesn't have permissions matching the expected pattern.
func ValidatePluginRole(pluginID string, role RoleDTO) error {
	if pluginID == "" {
		return ErrPluginIDRequired
	}
	if !strings.HasPrefix(role.Name, AppPluginRolePrefix+pluginID+":") {
		return &ErrorRolePrefixMissing{Role: role.Name, Prefixes: []string{AppPluginRolePrefix + pluginID + ":"}}
	}

	return ValidatePluginPermissions(pluginID, role.Permissions)
}
