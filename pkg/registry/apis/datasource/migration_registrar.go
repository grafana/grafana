package datasource

import (
	"github.com/grafana/grafana/pkg/registry/apis/datasource/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// DataSourceMigration returns the MigrationDefinition for datasource config migration.
// A single "primary" GroupResource is used for config/registration, while the actual
// MigratorFunc streams each datasource with its per-plugin GroupResource key.
func DataSourceMigration(dsMigrator migrator.DataSourceMigrator) migrations.MigrationDefinition {
	dsGR := schema.GroupResource{Group: "datasource.grafana.app", Resource: "datasources"}

	return migrations.MigrationDefinition{
		ID:          "datasources",
		MigrationID: "datasources migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: dsGR, LockTables: []string{"data_source"}},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			dsGR: dsMigrator.MigrateDataSources,
		},
		Validators: []migrations.ValidatorFactory{
			migrator.DataSourceCountValidation(),
		},
		// data_source table is still used by other code paths
		RenameTables: []string{},
	}
}
