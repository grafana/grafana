package migrator

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

// DataSourceMigration returns the MigrationDefinition for datasource config migration.
// A single "primary" GroupResource is used for config/registration, while the actual
// MigratorFunc streams each datasource with its per-plugin GroupResource key.
func DataSourceMigration(dsMigrator DataSourceMigrator) migrations.MigrationDefinition {
	// TODO: read these from somewhere dynamic, like we do when registering API endpoints.
	pGR := schema.GroupResource{Group: "datasource.grafana.app", Resource: "prometheus"}
	tGR := schema.GroupResource{Group: "datasource.grafana.app", Resource: "grafana-testdata-datasource"}

	return migrations.MigrationDefinition{
		ID:          "datasource",
		MigrationID: "datasources migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: pGR, LockTables: []string{"data_source"}},
			{GroupResource: tGR, LockTables: []string{"data_source"}},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			pGR: dsMigrator.MigrateDataSources,
			tGR: dsMigrator.MigrateDataSources,
		},
		Validators: []migrations.ValidatorFactory{
			DataSourceCountValidation(),
		},
		// data_source table is still used by other code paths
		RenameTables: []string{},
	}
}
