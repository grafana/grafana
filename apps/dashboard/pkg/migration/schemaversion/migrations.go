package schemaversion

import (
	"strconv"
)

const (
	MIN_VERSION    = 21
	LATEST_VERSION = 41
)

type SchemaVersionMigrationFunc func(map[string]interface{}) error

type DataSourceInfo struct {
	Default    bool
	UID        string
	Name       string
	Type       string
	ID         int64
	APIVersion string
}

type DataSourceInfoProvider interface {
	GetDataSourceInfo() []DataSourceInfo
}

type PanelPluginInfo struct {
	ID      string
	Version string
}

type PanelPluginInfoProvider interface {
	// Gets all the panels from the plugin store.
	// Equivalent to grafanaBootData.settings.panels on the frontend.
	GetPanels() []PanelPluginInfo
	GetPanelPlugin(id string) PanelPluginInfo
}

func GetMigrations(dsInfoProvider DataSourceInfoProvider, panelProvider PanelPluginInfoProvider) map[int]SchemaVersionMigrationFunc {
	return map[int]SchemaVersionMigrationFunc{
		22: V22,
		23: V23,
		24: V24(panelProvider),
		25: V25,
		26: V26,
		27: V27,
		28: V28(panelProvider),
		29: V29,
		30: V30,
		31: V31,
		32: V32,
		33: V33(dsInfoProvider),
		34: V34,
		35: V35,
		36: V36(dsInfoProvider),
		37: V37,
		38: V38,
		39: V39,
		40: V40,
		41: V41,
	}
}

func GetSchemaVersion(dash map[string]interface{}) int {
	if v, ok := dash["schemaVersion"]; ok {
		switch v := v.(type) {
		case int:
			return v
		case float64:
			return int(v)
		case string:
			if version, err := strconv.Atoi(v); err == nil {
				return version
			}
			return 0
		}
	}
	return 0
}
