package schemaversion

import (
	"context"
	"strconv"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	MIN_VERSION    = 0
	LATEST_VERSION = 42
)

type SchemaVersionMigrationFunc func(context.Context, map[string]any) error

type DataSourceInfo struct {
	Default    bool
	UID        string
	Name       string
	Type       string
	ID         int64
	APIVersion string
}

type DataSourceIndexProvider interface {

	// Index returns a pre-built index for O(1) datasource lookups.
	Index(ctx context.Context) *DatasourceIndex
}

type LibraryElementInfo struct {
	UID         string
	Name        string
	Kind        int64
	Type        string
	Description string
	FolderUID   string
	Model       common.Unstructured // JSON model of the library element, used to extract repeat options during migration
}

type LibraryElementIndexProvider interface {

	// GetLibraryElementInfo returns library element information for use in migrations.
	GetLibraryElementInfo(ctx context.Context) []LibraryElementInfo
}

type PanelPluginInfo struct {
	ID      string
	Version string
}

func GetMigrations(dsIndexProvider DataSourceIndexProvider, _ LibraryElementIndexProvider) map[int]SchemaVersionMigrationFunc {
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
		33: V33(dsIndexProvider),
		34: V34,
		35: V35,
		36: V36(dsIndexProvider),
		37: V37,
		38: V38,
		39: V39,
		40: V40,
		41: V41,
		42: V42,
	}
}

func GetSchemaVersion(dash map[string]any) int {
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
