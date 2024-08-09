package zanzana

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

// RBAC to OpenFGA translations grouped by kind
var actionKindTranslations = map[string]actionKindTranslation{
	"folders": {
		objectType:   "folder",
		orgScoped:    true,
		translations: folderActions,
	},
	"dashboards": {
		objectType:   "dashboard",
		orgScoped:    true,
		translations: dashboardActions,
	},
}
