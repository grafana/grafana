package zanzana

import (
	dashboardalpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	folderalpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
)

type actionKindTranslation struct {
	objectType   string
	orgScoped    bool
	translations map[string]string
}

// rbac action to relation translation
var folderActions = map[string]string{
	"folders:create":            "create",
	"folders:read":              "read",
	"folders:write":             "write",
	"folders:delete":            "delete",
	"folders.permissions:read":  "permissions_read",
	"folders.permissions:write": "permissions_write",

	"dashboards:create":            "dashboard_create",
	"dashboards:read":              "dashboard_read",
	"dashboards:write":             "dashboard_write",
	"dashboards:delete":            "dashboard_delete",
	"dashboards.permissions:read":  "dashboard_permissions_read",
	"dashboards.permissions:write": "dashboard_permissions_write",

	"library.panels:create": "library_panel_create",
	"library.panels:read":   "library_panel_read",
	"library.panels:write":  "library_panel_write",
	"library.panels:delete": "library_panel_delete",

	"alert.rules:create": "alert_rule_create",
	"alert.rules:read":   "alert_rule_read",
	"alert.rules:write":  "alert_rule_write",
	"alert.rules:delete": "alert_rule_delete",

	"alert.silences:create": "alert_silence_create",
	"alert.silences:read":   "alert_silence_read",
	"alert.silences:write":  "alert_silence_write",
}

var dashboardActions = map[string]string{
	"dashboards:create":            "create",
	"dashboards:read":              "read",
	"dashboards:write":             "write",
	"dashboards:delete":            "delete",
	"dashboards.permissions:read":  "permissions_read",
	"dashboards.permissions:write": "permissions_write",
}

var orgActions = map[string]string{
	"folders:create":            "folder_create",
	"folders:read":              "folder_read",
	"folders:write":             "folder_write",
	"folders:delete":            "folder_delete",
	"folders.permissions:read":  "folder_permissions_read",
	"folders.permissions:write": "folder_permissions_write",

	"dashboards:create":            "dashboard_create",
	"dashboards:read":              "dashboard_read",
	"dashboards:write":             "dashboard_write",
	"dashboards:delete":            "dashboard_delete",
	"dashboards.permissions:read":  "dashboard_permissions_read",
	"dashboards.permissions:write": "dashboard_permissions_write",

	"library.panels:create": "library_panel_create",
	"library.panels:read":   "library_panel_read",
	"library.panels:write":  "library_panel_write",
	"library.panels:delete": "library_panel_delete",

	"alert.rules:create": "alert_rule_create",
	"alert.rules:read":   "alert_rule_read",
	"alert.rules:write":  "alert_rule_write",
	"alert.rules:delete": "alert_rule_delete",

	"alert.silences:create": "alert_silence_create",
	"alert.silences:read":   "alert_silence_read",
	"alert.silences:write":  "alert_silence_write",
}

// RBAC to OpenFGA translations grouped by kind
var actionKindTranslations = map[string]actionKindTranslation{
	KindOrg: {
		objectType:   TypeOrg,
		orgScoped:    false,
		translations: orgActions,
	},
	KindFolders: {
		objectType:   TypeFolder,
		orgScoped:    true,
		translations: folderActions,
	},
	KindDashboards: {
		objectType:   TypeDashboard,
		orgScoped:    true,
		translations: dashboardActions,
	},
}

var basicRolesTranslations = map[string]string{
	RoleGrafanaAdmin: "basic_grafana_admin",
	RoleAdmin:        "basic_admin",
	RoleEditor:       "basic_editor",
	RoleViewer:       "basic_viewer",
	RoleNone:         "basic_none",
}

type resourceTranslation struct {
	typ      string
	group    string
	resource string
	mapping  map[string]actionMappig
}

type actionMappig struct {
	relation string
	group    string
	resource string
}

func newMapping(relation string) actionMappig {
	return newScopedMapping(relation, "", "")
}

func newScopedMapping(relation, group, resource string) actionMappig {
	return actionMappig{relation, group, resource}
}

var (
	folderGroup    = folderalpha1.FolderResourceInfo.GroupResource().Group
	folderResource = folderalpha1.FolderResourceInfo.GroupResource().Resource

	dashboardGroup    = dashboardalpha1.DashboardResourceInfo.GroupResource().Group
	dashboardResource = dashboardalpha1.DashboardResourceInfo.GroupResource().Resource
)

var resourceTranslations = map[string]resourceTranslation{
	KindFolders: {
		typ:      TypeFolder2,
		group:    folderGroup,
		resource: folderResource,
		mapping: map[string]actionMappig{
			"folders:read":                 newMapping(RelationRead),
			"folders:write":                newMapping(RelationWrite),
			"folders:create":               newMapping(RelationCreate),
			"folders:delete":               newMapping(RelationDelete),
			"folders.permissions:read":     newMapping(RelationPermissionsRead),
			"folders.permissions:write":    newMapping(RelationPermissionsWrite),
			"dashboards:read":              newScopedMapping(RelationRead, dashboardGroup, dashboardResource),
			"dashboards:write":             newScopedMapping(RelationWrite, dashboardGroup, dashboardResource),
			"dashboards:create":            newScopedMapping(RelationCreate, dashboardGroup, dashboardResource),
			"dashboards:delete":            newScopedMapping(RelationDelete, dashboardGroup, dashboardResource),
			"dashboards.permissions:read":  newScopedMapping(RelationPermissionsRead, dashboardGroup, dashboardResource),
			"dashboards.permissions:write": newScopedMapping(RelationPermissionsWrite, dashboardGroup, dashboardResource),
		},
	},
	KindDashboards: {
		typ:      TypeResource,
		group:    dashboardGroup,
		resource: dashboardResource,
		mapping: map[string]actionMappig{
			"dashboards:read":              newMapping(RelationRead),
			"dashboards:write":             newMapping(RelationWrite),
			"dashboards:create":            newMapping(RelationCreate),
			"dashboards:delete":            newMapping(RelationDelete),
			"dashboards.permissions:read":  newMapping(RelationPermissionsRead),
			"dashboards.permissions:write": newMapping(RelationPermissionsWrite),
		},
	},
}
