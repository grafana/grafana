package plugins

import (
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// Plugins actions
	ActionInstall = "plugins:install"
	ActionWrite   = "plugins:write"
	ActionRead    = "plugins:read"

	// App Plugins actions
	ActionAppAccess = "plugins.app:access"
)

var (
	ScopeProvider = ac.NewScopeProvider("plugins")
)

// Protects install endpoints
func InstallEvaluator(pluginID string) ac.Evaluator {
	return ac.EvalAll(
		ac.EvalPermission(ActionInstall),
		ac.EvalPermission(ActionRead, ScopeProvider.GetResourceScope(pluginID)))
}

// Protects access to the Configuration > Plugins page
func AdminAccessEvaluator(cfg *setting.Cfg) ac.Evaluator {
	// This preserves the legacy behavior
	// Grafana Admins get access to the page if cfg.PluginAdminEnabled (even if they can only list plugins)
	// Org Admins can access the tab whenever
	if cfg.PluginAdminEnabled {
		return ac.EvalAny(
			ac.EvalPermission(ActionWrite),
			ac.EvalPermission(ActionInstall),
			ac.EvalPermission(ActionRead))
	}

	// Plugin Admin is disabled  => No installation
	return ac.EvalPermission(ActionWrite)
}

// Legacy handler that protects access to the Configuration > Plugins page
func ReqCanAdminPlugins(cfg *setting.Cfg) func(rc *models.ReqContext) bool {
	return func(rc *models.ReqContext) bool {
		return rc.OrgRole == org.RoleAdmin || cfg.PluginAdminEnabled && rc.IsGrafanaAdmin
	}
}

// Legacy handler that protects listing plugins
func ReqCanReadPlugin(pluginDef PluginDTO) func(c *models.ReqContext) bool {
	if pluginDef.IsCorePlugin() {
		return ac.ReqSignedIn
	}
	return ac.ReqHasRole(org.RoleAdmin)
}

func DeclareRBACRoles(service ac.Service, cfg *setting.Cfg) error {
	AppPluginsReader := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        ac.FixedRolePrefix + "plugins.app:reader",
			DisplayName: "Application Plugins Access",
			Description: "Access application plugins (still enforcing the organization role)",
			Group:       "Plugins",
			Permissions: []ac.Permission{
				{Action: ActionAppAccess, Scope: ScopeProvider.GetResourceAllIDScope()},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}
	// With RBAC Viewers can now list non-core plugins as it was already possible for them to access their settings
	// through the /api/plugins/<pluginID>/settings endpoint.
	PluginsReader := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        ac.FixedRolePrefix + "plugins:reader",
			DisplayName: "Plugin Reader",
			Description: "List plugins",
			Group:       "Plugins",
			Permissions: []ac.Permission{
				{Action: ActionRead, Scope: ScopeProvider.GetResourceAllIDScope()},
			},
		},
		Grants: []string{string(org.RoleViewer)},
	}
	PluginsWriter := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        ac.FixedRolePrefix + "plugins:writer",
			DisplayName: "Plugin Writer",
			Description: "Enable and disable plugins and edit plugins' settings",
			Group:       "Plugins",
			Permissions: []ac.Permission{
				{Action: ActionWrite, Scope: ScopeProvider.GetResourceAllIDScope()},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}
	PluginsMaintainer := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        ac.FixedRolePrefix + "plugins:maintainer",
			DisplayName: "Plugin Maintainer",
			Description: "Install, uninstall plugins",
			Group:       "Plugins",
			Permissions: []ac.Permission{
				{Action: ActionInstall},
			},
		},
		Grants: []string{ac.RoleGrafanaAdmin},
	}

	if !cfg.PluginAdminEnabled || cfg.PluginAdminExternalManageEnabled {
		PluginsMaintainer.Grants = []string{}
	}

	return service.DeclareFixedRoles(AppPluginsReader, PluginsReader, PluginsWriter, PluginsMaintainer)
}
