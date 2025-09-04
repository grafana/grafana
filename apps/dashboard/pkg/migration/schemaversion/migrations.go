package schemaversion

import (
	"strconv"

	"golang.org/x/net/context"
)

const (
	MIN_VERSION    = 13
	LATEST_VERSION = 41
)

type SchemaVersionMigrationFunc func(context.Context, map[string]interface{}) error

type DataSourceInfo struct {
	Default    bool
	UID        string
	Name       string
	Type       string
	ID         int64
	APIVersion string
}

type DataSourceInfoProvider interface {
	// GetDataSourceInfo returns a list of all data sources with their info
	// The context must have the namespace in it
	GetDataSourceInfo(ctx context.Context) []DataSourceInfo
}

type PanelPluginInfo struct {
	ID      string
	Version string
}

func GetMigrations(dsInfoProvider DataSourceInfoProvider) map[int]SchemaVersionMigrationFunc {
	return map[int]SchemaVersionMigrationFunc{
		14: V14,
		15: V15,
		16: V16,
		17: V17,
		18: V18,
		19: V19,
		20: V20,
		21: V21,
		22: V22,
		23: V23,
		24: V24,
		25: V25,
		26: V26,
		27: V27,
		28: V28,
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
