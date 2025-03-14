package migration

import "github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"

func Migrate(dash map[string]interface{}, targetVersion int) error {
	if dash == nil {
		dash = map[string]interface{}{}
	}
	inputVersion := schemaversion.GetSchemaVersion(dash)
	dash["schemaVersion"] = inputVersion

	// If the schema version is older than the minimum version, with migration support,
	// we don't migrate the dashboard.
	if inputVersion < schemaversion.MIN_VERSION {
		return schemaversion.NewMigrationError("schema version is too old", inputVersion, schemaversion.MIN_VERSION)
	}

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
