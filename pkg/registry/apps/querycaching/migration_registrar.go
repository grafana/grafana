package querycaching

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/registry/apps/querycaching/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

func QueryCacheConfigMigration(m migrator.QueryCacheConfigMigrator) migrations.MigrationDefinition {
	gr := schema.GroupResource{Group: migrator.APIGroup, Resource: migrator.Resource}

	return migrations.MigrationDefinition{
		ID:          "querycacheconfigs",
		MigrationID: "querycacheconfigs migration",
		Resources: []migrations.ResourceInfo{
			{
				GroupResource: gr,
				LockTables:    []string{"data_source_cache", "data_source"},
				FloorVersion:  migrator.APIVersion,
			},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			gr: m.MigrateQueryCacheConfigs,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(gr, migrations.CountValidationOptions{
				Table:    "data_source_cache",
				Where:    "data_source_uid IN (SELECT uid FROM data_source WHERE org_id = ?)",
				Distinct: "data_source_uid",
			}),
		},
		RenameTables:    []string{"data_source_cache"},
		SkipWhenMissing: true,
	}
}
