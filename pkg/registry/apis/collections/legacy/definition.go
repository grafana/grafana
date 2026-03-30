package legacy

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	collectionsV1 "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

func StarsMigrationDefinition(migrator StarsMigrator) migrations.MigrationDefinition {
	starsGR := schema.GroupResource{Group: collectionsV1.APIGroup, Resource: "stars"}

	return migrations.MigrationDefinition{
		ID:          "stars",
		MigrationID: "stars migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: starsGR, LockTables: []string{"stars"}},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			starsGR: migrator.MigrateStars,
		},
		Validators: []migrations.ValidatorFactory{
			//migrations.CountValidation(starsGR, "playlist", "org_id = ?"),
		},
		RenameTables: []string{},
	}
}
