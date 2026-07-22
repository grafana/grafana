package preferences

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	preferencesV1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

func PreferencesMigration(migrator legacy.PreferencesMigrator) migrations.MigrationDefinition {
	preferencesGR := schema.GroupResource{Group: preferencesV1.APIGroup, Resource: "preferences"}

	return migrations.MigrationDefinition{
		ID:          "preferences",
		MigrationID: "preferences migration",
		Resources: []migrations.ResourceInfo{
			{
				GroupResource: preferencesGR,
				LockTables:    []string{"preferences", "user", "team"},
				FloorVersion:  preferencesV1.APIVersion,
			},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			preferencesGR: migrator.MigratePreferences,
		},
		Validators: []migrations.ValidatorFactory{
			// Strict count parity using a custom query that mirrors the read
			// path: counts every row the migrator emits a resource for
			// (namespace + valid user + valid team), excluding orphans.
			legacy.PreferencesCountValidation(preferencesGR),
		},
		RenameTables: []string{},
	}
}
