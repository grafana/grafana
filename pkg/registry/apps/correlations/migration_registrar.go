package correlations

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/correlations/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

func CorrelationsMigration(m migrator.CorrelationsMigrator) migrations.MigrationDefinition {
	correlationsGR := schema.GroupResource{Group: correlationsV0.APIGroup, Resource: "correlations"}

	return migrations.MigrationDefinition{
		ID:          "correlations",
		MigrationID: "correlations migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: correlationsGR, LockTables: []string{"correlation"}},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			correlationsGR: m.MigrateCorrelations,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(correlationsGR, migrations.CountValidationOptions{
				Table: "correlation",
				Where: "org_id = ?",
			}),
		},
		RenameTables: []string{},
	}
}
