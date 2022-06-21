package plugins

import (
	"strings"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// takes plugin config => declare roles

const (
	PluginsAppRolePrefix = "plugins.app"
	ActionAppAccess      = "plugins.app:access"
)

const (
	ScopeApp = "<pluginID>:path:<path>"
)

func FixedRoleFromPlugin(plugin *Plugin) []accesscontrol.RoleRegistration {
	roles := map[string]accesscontrol.RoleRegistration{}

	// TODO check include type ? (dashboard, page)
	// TODO check path => slug path?
	// TODO check role => default viewer
	// TODO generate permissions for routes?

	for _, include := range plugin.JSONData.Includes {
		reg, ok := roles[string(include.Role)]
		if !ok {
			reg.Role.Name = accesscontrol.FixedRolePrefix + plugin.ID + ":" + strings.ToLower(string(include.Role))
			reg.Role.Group = "Plugins"
			reg.Grants = []string{string(include.Role)}
		}

		reg.Role.Permissions = append(reg.Role.Permissions, accesscontrol.Permission{
			Action: ActionAppAccess,
			Scope:  PluginAppScope(plugin.ID, include.Path),
		})
		roles[string(include.Role)] = reg
	}

	registrations := make([]accesscontrol.RoleRegistration, 0, len(roles))
	for _, role := range roles {
		registrations = append(registrations, role)
	}

	return registrations
}

func PluginAppScope(id, path string) string {
	return accesscontrol.Scope(id, "path", path)
}
