package migration

import "github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"

func Migrate(dash map[string]interface{}, targetVersion int) error {
	inputVersion := schemaversion.GetSchemaVersion(dash)

	// apply schema version migrations
	for nextVersion := inputVersion + 1; nextVersion <= targetVersion; nextVersion++ {
		if migration, ok := schemaversion.Migrations[nextVersion]; ok {
			if err := migration(dash); err != nil {
				return err
			}
		}
	}

	return nil
}
