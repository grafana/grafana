package librarypanel

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	migrator "github.com/grafana/grafana/pkg/registry/apps/librarypanel/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

func LibraryPanelMigration(migrator migrator.LibraryPanelMigrator) migrations.MigrationDefinition {
	libraryPanelGR := schema.GroupResource{
		Group:    dashboardV0.GROUP,
		Resource: dashboardV0.LIBRARY_PANEL_RESOURCE,
	}

	return migrations.MigrationDefinition{
		ID:          "librarypanels",
		MigrationID: "librarypanels migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: libraryPanelGR, LockTables: []string{"library_element"}},
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
		// library_element is still served by the legacy LibraryPanelStore until
		// callers move to unified storage exclusively; do not rename it yet.
		RenameTables: []string{},
	}
}
