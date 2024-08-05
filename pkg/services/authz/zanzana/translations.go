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
}
