package dashboard

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

func LibraryPanelsMigration(migrator migrator.LibraryPanelsMigrator) migrations.MigrationDefinition {
	libraryPanelGR := schema.GroupResource{
		Group:    dashV0.GROUP,
		Resource: dashV0.LIBRARY_PANEL_RESOURCE,
	}

	return migrations.MigrationDefinition{
		ID:          "librarypanels",
		MigrationID: "librarypanels migration",
		Resources: []migrations.ResourceInfo{
			{
				GroupResource: libraryPanelGR,
				LockTables:    []string{"library_element"},
				FloorVersion:  dashV0.VERSION,
			},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			libraryPanelGR: migrator.MigrateLibraryPanels,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(libraryPanelGR, migrations.CountValidationOptions{
				Table: "library_element",
				Where: "org_id = ?",
			}),
		},
		// The library_element table is still read by the legacy service in dual-write modes
		RenameTables: []string{},
	}
}
