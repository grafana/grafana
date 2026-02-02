package mig_rbac

// BhdRolePermission - DO NOT CHANGE THE ORDER OF ATTRIBUTES
type BhdRolePermission struct {
	Group         string
	Permission    string
	DisplayName   string
	Description   string
	AlwaysEnabled bool
}

var bhdRoleAdminPermissions = []BhdRolePermission{
	{"Dashboards", "dashboards:read", "View", "can view permitted dashboards", true},                   // can view dashboards
	{"Dashboards", "dashboards:create", "Create", "can create dashboards", false},                      // can create and edit dashboards
	{"Dashboards", "dashboards:download", "Download", "can download dashboard as pdf/xlsx/csv", false}, // can download dashboards

	{"Folders", "folders:read", "View", "can view permitted folders", true}, // can view and manage folders
	{"Folders", "folders:create", "Create", "can create folders", false},    // can create and edit folders

	{"Calculated fields", "calculated.fields:read", "View", "can view calculated fields", false},                 // can view calculated fields
	{"Calculated fields", "calculated.fields:create", "Create", "can create or update calculated fields", false}, // can create calculated fields

	{"Datasources", "datasources:explore", "Explore", "can use explore mode for datasources", false},

	{"Reports", "reports:access", "Access", "can view and create reports", false},                  // can view reports section and create reports
	{"Reports", "reports.history:read", "View history", "can view reports history section", false}, // can view reports history
	{"Reports", "reports.settings:read", "View settings", "can view reports settings", false},      // can view setting

	{"Administration", "administration.datasources:manage", "Manage datasources", "can manage datasources", false},  // can view and manage datasources
	{"Administration", "administration.reports:manage", "Manage report scheduler", "can manage all reports", false}, // can view and manage all reports
}

var bhdRoleEditorPermissions = []BhdRolePermission{
	{"Dashboards", "dashboards:read", "View", "can view permitted dashboards", true},                   // can view dashboards
	{"Dashboards", "dashboards:create", "Create", "can create dashboards", false},                      // can create and edit dashboards
	{"Dashboards", "dashboards:download", "Download", "can download dashboard as pdf/xlsx/csv", false}, // can download dashboards

	{"Folders", "folders:read", "View", "can view permitted folders", true}, // can view and manage folders
	{"Folders", "folders:create", "Create", "can create folders", false},    // can create and edit folders

	{"Calculated fields", "calculated.fields:read", "View", "can view calculated fields", false},                 // can view calculated fields
	{"Calculated fields", "calculated.fields:create", "Create", "can create or update calculated fields", false}, // can create calculated fields

	{"Datasources", "datasources:explore", "Explore", "can use explore mode for datasources", false},

	{"Reports", "reports:access", "Access", "can view and create reports", false}, // can view reports section and create reports
}

var bhdRoleViewerPermissions = []BhdRolePermission{
	{"Dashboards", "dashboards:read", "View", "can view permitted dashboards", true}, // can view dashboards
	{"Folders", "folders:read", "View", "can view permitted folders", true},          // can view and manage folders
}

var BhdSupportedPermissions = bhdRoleAdminPermissions
var BhdBuiltInAdminPermissions = bhdRoleAdminPermissions
var BhdBuiltInEditorPermissions = bhdRoleEditorPermissions
var BhdBuiltInViewerPermissions = bhdRoleViewerPermissions
