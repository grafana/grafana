package schemaversion

import "strconv"

type SchemaVersionMigrationFunc func(map[string]interface{}) error

const (
	MINIUM_VERSION = 39
	LATEST_VERSION = 40
)

var Migrations = map[int]SchemaVersionMigrationFunc{
	40: V40,
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
