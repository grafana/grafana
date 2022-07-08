package plugins

import (
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	// Plugins actions
	ActionIntall = "plugins:install"
	ActionToggle = "plugins:toggle"

	// App Plugins actions
	ActionAppAccess = "plugins.app:access"
)

var (
	ScopeProvider = ac.NewScopeProvider("plugins")
	// Protects access to the Configuration > Plugins page
	// FIXME: In another iteration we'll add a settings permission check as well
	ConfigurationAccessEvaluator = ac.EvalPermission(ActionToggle)

	// Protects access to the Server Admin > Plugins page
	// FIXME: In another iteration we'll add a settings permission check as well
	AdminAccessEvaluator = ac.EvalAny(
		ac.EvalPermission(ActionIntall),
		ac.EvalPermission(ActionToggle),
	)
)

func DeclareRBACRoles(acService ac.AccessControl) error {
	AppPluginsReader := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        ac.FixedRolePrefix + "plugins.app:reader",
			DisplayName: "Application Plugins Access",
			Description: "Access application plugins (still enforcing the organization role)",
			Group:       "Plugins",
			Permissions: []ac.Permission{
				{Action: ActionAppAccess, Scope: ScopeProvider.GetResourceAllScope()},
			},
		},
		Grants: []string{string(models.ROLE_VIEWER)},
	}
	PluginsWriter := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        ac.FixedRolePrefix + "plugins:writer",
			DisplayName: "Plugin Writer",
			Description: "Enable and disable plugins, view and edit plugins' settings",
			Group:       "Plugins",
			Permissions: []ac.Permission{
				{Action: ActionToggle, Scope: ScopeProvider.GetResourceAllScope()},
			},
		},
		Grants: []string{string(models.ROLE_ADMIN)},
	}
	PluginsMaintainer := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        ac.FixedRolePrefix + "plugins:maintainer",
			DisplayName: "Plugin Maintainer",
			Description: "Install, uninstall, enable, disable plugins",
			Group:       "Plugins",
			Permissions: []ac.Permission{
				{Action: ActionIntall},
				{Action: ActionToggle, Scope: ScopeProvider.GetResourceAllScope()},
			},
		},
		Grants: []string{ac.RoleGrafanaAdmin},
	}
	return acService.DeclareFixedRoles(AppPluginsReader, PluginsWriter, PluginsMaintainer)
}
