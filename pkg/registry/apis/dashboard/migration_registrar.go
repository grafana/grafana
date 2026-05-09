package dashboard

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	v1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

func FoldersDashboardsMigration(migrator migrator.FoldersDashboardsMigrator) migrations.MigrationDefinition {
	folderGR := schema.GroupResource{Group: folders.GROUP, Resource: folders.RESOURCE}
	dashboardGR := schema.GroupResource{Group: v1.GROUP, Resource: v1.DASHBOARD_RESOURCE}

	return migrations.MigrationDefinition{
		ID:          migrations.FoldersDashboardsMigrationID,
		MigrationID: "folders and dashboards migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: folderGR, LockTables: []string{"dashboard", "dashboard_version", "dashboard_provisioning"}},
			{GroupResource: dashboardGR, LockTables: []string{"dashboard", "dashboard_version", "dashboard_provisioning"}},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			folderGR:    migrator.MigrateFolders,
			dashboardGR: migrator.MigrateDashboards,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(folderGR, migrations.CountValidationOptions{
				Table: "dashboard",
				Where: "org_id = ? AND is_folder = true AND deleted IS NULL",
			}),
			migrations.CountValidation(dashboardGR, migrations.CountValidationOptions{
				Table: "dashboard",
				Where: "org_id = ? AND is_folder = false AND deleted IS NULL",
			}),
			migrations.FolderTreeValidation(folderGR),
		},
		// Folder and Dashboard tables are still being used
		RenameTables: []string{},
	}
}
