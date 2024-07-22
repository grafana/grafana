package pluginaccesscontrol

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// Plugins actions
	ActionInstall = "plugins:install"
	ActionWrite   = "plugins:write"

	// App Plugins actions
	ActionAppAccess = "plugins.app:access"
)

var (
	ScopeProvider = ac.NewScopeProvider("plugins")
	// Protects access to the Configuration > Plugins page
	AdminAccessEvaluator = ac.EvalAny(ac.EvalPermission(ActionWrite), ac.EvalPermission(ActionInstall))
)

// RoleRegistry handles the plugin RBAC roles and their assignments
type RoleRegistry interface {
	DeclarePluginRoles(ctx context.Context, ID, name string, registrations []plugins.RoleRegistration) error
}

// ActionSetRegistry handles the plugin RBAC actionsets
type ActionSetRegistry interface {
	RegisterActionSets(ctx context.Context, ID string, registrations []plugins.ActionSet) error
}

func ReqCanAdminPlugins(cfg *setting.Cfg) func(rc *contextmodel.ReqContext) bool {
	// Legacy handler that protects access to the Configuration > Plugins page
	return func(rc *contextmodel.ReqContext) bool {
		return rc.OrgRole == org.RoleAdmin || cfg.PluginAdminEnabled && rc.IsGrafanaAdmin
	}
}

func DeclareRBACRoles(service ac.Service, cfg *setting.Cfg, features featuremgmt.FeatureToggles) error {
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
		Grants: []string{string(org.RoleViewer)},
	}
	PluginsWriter := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        ac.FixedRolePrefix + "plugins:writer",
			DisplayName: "Plugin Writer",
			Description: "Enable and disable plugins and edit plugins' settings",
			Group:       "Plugins",
			Permissions: []ac.Permission{
				{Action: ActionWrite, Scope: ScopeProvider.GetResourceAllScope()},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}
	PluginsMaintainer := ac.RoleRegistration{
		Role: ac.RoleDTO{
			Name:        ac.FixedRolePrefix + "plugins:maintainer",
			DisplayName: "Plugin Maintainer",
			Description: "Install, uninstall plugins. Needs to be assigned globally.",
			Group:       "Plugins",
			Permissions: []ac.Permission{
				{Action: ActionInstall},
			},
		},
		Grants: []string{ac.RoleGrafanaAdmin},
	}

	if !cfg.PluginAdminEnabled ||
		(cfg.PluginAdminExternalManageEnabled && !features.IsEnabledGlobally(featuremgmt.FlagManagedPluginsInstall)) {
		PluginsMaintainer.Grants = []string{}
	}

	return service.DeclareFixedRoles(AppPluginsReader, PluginsWriter, PluginsMaintainer)
}
