package schemaversion

import (
	"strconv"

	"golang.org/x/net/context"
)

const (
	MIN_VERSION    = 0
	LATEST_VERSION = 42
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

// LibraryPanelInfoProvider provides access to library panel models
type LibraryPanelInfoProvider interface {
	// GetPanelModelByUID returns the panel model for a library panel by its UID
	// The context must have the namespace in it
	// Returns the panel model as a map[string]interface{} or nil if not found
	GetPanelModelByUID(ctx context.Context, uid string) (map[string]interface{}, error)
}

type PanelPluginInfo struct {
	ID      string
	Version string
}

func GetMigrations(dsInfoProvider DataSourceInfoProvider) map[int]SchemaVersionMigrationFunc {
	return map[int]SchemaVersionMigrationFunc{
		2:  V2,
		3:  V3,
		4:  V4,
		5:  V5,
		6:  V6,
		7:  V7,
		8:  V8,
		9:  V9,
		10: V10,
		11: V11,
		12: V12,
		13: V13,
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
		42: V42,
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
