package migration

import "github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"

func Migrate(dash map[string]interface{}, targetVersion int) error {
	if dash == nil {
		dash = map[string]interface{}{}
	}
	inputVersion := schemaversion.GetSchemaVersion(dash)
	dash["schemaVersion"] = inputVersion

	for nextVersion := inputVersion + 1; nextVersion <= targetVersion; nextVersion++ {
		if migration, ok := schemaversion.Migrations[nextVersion]; ok {
			if err := migration(dash); err != nil {
				return schemaversion.NewMigrationError("migration failed", inputVersion, nextVersion)
			}
			dash["schemaVersion"] = nextVersion
		}
	}

	if schemaversion.GetSchemaVersion(dash) != targetVersion {
		return schemaversion.NewMigrationError("schema version not migrated to target version", inputVersion, targetVersion)
	}

	return nil
}
