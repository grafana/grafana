package collections

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	collectionsV1 "github.com/grafana/grafana/apps/collections/pkg/apis/collections/v1alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/collections/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

func StarsMigration(migrator legacy.StarsMigrator) migrations.MigrationDefinition {
	starsGR := schema.GroupResource{Group: collectionsV1.APIGroup, Resource: "stars"}

	return migrations.MigrationDefinition{
		ID:          "stars",
		MigrationID: "stars migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: starsGR, LockTables: []string{"star", "user"}},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			starsGR: migrator.MigrateStars,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(starsGR, migrations.CountValidationOptions{
				Table:    "star",
				Where:    "star.org_id = ?",
				Distinct: "star.user_id",
				// Join filters out orphaned stars whose user has been deleted,
				// matching exactly what MigrateStars processes via sql_list_users.sql.
				Join: &migrations.CountValidationJoin{
					Table: []string{"user", "u"},
					On:    "star.user_id = u.id",
				},
			}),
		},
		RenameTables: []string{},
	}
}
