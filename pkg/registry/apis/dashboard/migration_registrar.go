package dashboard

import (
	v1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/migrations/resources"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

/*
FoldersDashboardsMigration returns the migration definition for folders and dashboards.
This is owned by the dashboard team and uses the ResourceMigrationService
to stream folder and dashboard resources from legacy SQL storage.
*/
func FoldersDashboardsMigration(accessor resources.ResourceMigrationService) migrations.MigrationDefinition {
	folderGR := schema.GroupResource{Group: folders.GROUP, Resource: folders.RESOURCE}
	dashboardGR := schema.GroupResource{Group: v1beta1.GROUP, Resource: v1beta1.DASHBOARD_RESOURCE}

	return migrations.MigrationDefinition{
		ID:          "folders-dashboards",
		MigrationID: "folders and dashboards migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: folderGR, LockTable: "folder"},
			{GroupResource: dashboardGR, LockTable: "dashboard"},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			folderGR:    accessor.MigrateFolders,
			dashboardGR: accessor.MigrateDashboards,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(folderGR, "dashboard", "org_id = ? AND is_folder = true AND deleted IS NULL"),
			migrations.CountValidation(dashboardGR, "dashboard", "org_id = ? AND is_folder = false AND deleted IS NULL"),
			migrations.FolderTreeValidation(folderGR),
		},
	}
}
