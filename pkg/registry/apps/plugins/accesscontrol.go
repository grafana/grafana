package plugins

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
)

const (
	// Plugins
	ActionPluginsPluginsCreate = "plugins.plugins:create" // CREATE.
	ActionPluginsPluginsWrite  = "plugins.plugins:write"  // UPDATE.
	ActionPluginsPluginsRead   = "plugins.plugins:read"   // GET + LIST.
	ActionPluginsPluginsDelete = "plugins.plugins:delete" // DELETE.

	// PluginMetas
	ActionPluginsPluginsMetaCreate = "plugins.metas:create" // CREATE.
	ActionPluginsPluginsMetaWrite  = "plugins.metas:write"  // UPDATE.
	ActionPluginsPluginsMetaRead   = "plugins.metas:read"   // GET + LIST.
	ActionPluginsPluginsMetaDelete = "plugins.metas:delete" // DELETE.
)

var (
	ScopeProviderPluginsPlugins     = accesscontrol.NewScopeProvider("plugins.plugins")
	ScopeProviderPluginsPluginsMeta = accesscontrol.NewScopeProvider("plugins.metas")

	ScopeAllPluginsPlugins     = ScopeProviderPluginsPlugins.GetResourceAllScope()
	ScopeAllPluginsPluginsMeta = ScopeProviderPluginsPluginsMeta.GetResourceAllScope()
)

func registerAccessControlRoles(service accesscontrol.Service) error {
	// Plugins
	pluginsReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:plugins.plugins:reader",
			DisplayName: "Plugins Reader",
			Description: "Read and list plugins.",
			Group:       "Plugins",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionPluginsPluginsRead,
					Scope:  ScopeAllPluginsPlugins,
				},
			},
		},
		Grants: []string{string(org.RoleViewer), string(org.RoleEditor), string(org.RoleAdmin)},
	}

	pluginsWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:plugins.plugins:writer",
			DisplayName: "Plugins Writer",
			Description: "Create, update and delete plugins.",
			Group:       "Plugins",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionPluginsPluginsCreate,
					Scope:  ScopeAllPluginsPlugins,
				},
				{
					Action: ActionPluginsPluginsRead,
					Scope:  ScopeAllPluginsPlugins,
				},
				{
					Action: ActionPluginsPluginsWrite,
					Scope:  ScopeAllPluginsPlugins,
				},
				{
					Action: ActionPluginsPluginsDelete,
					Scope:  ScopeAllPluginsPlugins,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	// PluginMetas
	pluginsMetaReader := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:plugins.metas:reader",
			DisplayName: "Plugin Metas Reader",
			Description: "Read and list plugin metadata.",
			Group:       "Plugins",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionPluginsPluginsMetaRead,
					Scope:  ScopeAllPluginsPluginsMeta,
				},
			},
		},
		Grants: []string{string(org.RoleViewer), string(org.RoleEditor), string(org.RoleAdmin)},
	}

	pluginsMetaWriter := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:plugins.metas:writer",
			DisplayName: "Plugin Metas Writer",
			Description: "Create, update and delete plugin metadata.",
			Group:       "Plugins",
			Permissions: []accesscontrol.Permission{
				{
					Action: ActionPluginsPluginsMetaCreate,
					Scope:  ScopeAllPluginsPluginsMeta,
				},
				{
					Action: ActionPluginsPluginsMetaRead,
					Scope:  ScopeAllPluginsPluginsMeta,
				},
				{
					Action: ActionPluginsPluginsMetaWrite,
					Scope:  ScopeAllPluginsPluginsMeta,
				},
				{
					Action: ActionPluginsPluginsMetaDelete,
					Scope:  ScopeAllPluginsPluginsMeta,
				},
			},
		},
		Grants: []string{string(org.RoleAdmin)},
	}

	return service.DeclareFixedRoles(
		pluginsReader,
		pluginsWriter,
		pluginsMetaReader,
		pluginsMetaWriter,
	)
}
