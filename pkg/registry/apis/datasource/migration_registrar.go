package datasource

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/datasource/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

// DataSourceMigration returns the MigrationDefinition for datasource config migration.
// A single "primary" GroupResource is used for config/registration, while the actual
// MigratorFunc streams each datasource with its per-plugin GroupResource key.
func DataSourceMigration(dsMigrator migrator.DataSourceMigrator) migrations.MigrationDefinition {
	gr := schema.GroupResource{Group: "datasource.grafana.app", Resource: "datasources"}

	return migrations.MigrationDefinition{
		ID:          "datasource",
		MigrationID: "datasources migration",
		Resources: []migrations.ResourceInfo{
			{
				GroupResource: gr,
				LockTables:    []string{"data_source"},
				// Per-plugin group (see ResourceGroupsFunc), all served at the v0alpha1 floor.
				FloorVersion: datasourceV0.VERSION,
			},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			gr: dsMigrator.MigrateDataSources,
		},
		Validators: []migrations.ValidatorFactory{
			migrator.DataSourceCountValidation(),
		},
		// data_source table is still used by other code paths
		RenameTables:       []string{},
		ResourceGroupsFunc: dsMigrator.PluginGroups,
	}
}
