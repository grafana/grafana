package zanzana

type kindTranslation struct {
	typ       string
	orgScoped bool
}

// all kinds that we can translate into a openFGA object
var kindTranslations = map[string]kindTranslation{
	"folders":    {typ: "folder", orgScoped: true},
	"dashboards": {typ: "dashboard", orgScoped: true},
}

// rbac action to relation translation
var actionTranslations = map[string]string{
	"folders:create":            "create",
	"folders:read":              "read",
	"folders:write":             "write",
	"folders:delete":            "delete",
	"folders.permissions:read":  "permissions_read",
	"folders.permissions:write": "permissions_write",

	"dashboards:create":            "create",
	"dashboards:read":              "read",
	"dashboards:write":             "write",
	"dashboards:delete":            "delete",
	"dashboards.permissions:read":  "permissions_read",
	"dashboards.permissions:write": "permissions_write",

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
