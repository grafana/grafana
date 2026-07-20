package correlations

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/correlations/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

func CorrelationMigration(m migrator.CorrelationMigrator) migrations.MigrationDefinition {
	correlationGR := schema.GroupResource{Group: correlationsV0.APIGroup, Resource: "correlations"}

	return migrations.MigrationDefinition{
		ID:          "correlations",
		MigrationID: "correlations migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: correlationGR, LockTables: []string{"correlation"}},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			correlationGR: m.MigrateCorrelations,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(correlationGR, migrations.CountValidationOptions{
				Table: "correlation",
				Where: "correlation.org_id = ?",
				// The migrator INNER JOINs data_source on source_uid, so orphaned
				// correlations (whose source datasource was deleted) are excluded.
				// The count validation must match the same set.
				Join: &migrations.CountValidationJoin{
					Table: []string{"data_source", "dss"},
					On:    "correlation.source_uid = dss.uid AND dss.org_id = correlation.org_id",
				},
			}),
		},
		RenameTables: []string{"correlation"},
	}
}
