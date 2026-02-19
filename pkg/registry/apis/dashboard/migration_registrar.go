package dashboard

import (
	v1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func FoldersDashboardsMigration(migrator migrator.FoldersDashboardsMigrator) migrations.MigrationDefinition {
	folderGR := schema.GroupResource{Group: folders.GROUP, Resource: folders.RESOURCE}
	dashboardGR := schema.GroupResource{Group: v1beta1.GROUP, Resource: v1beta1.DASHBOARD_RESOURCE}

	return migrations.MigrationDefinition{
		ID:          "folders-dashboards",
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
			migrations.CountValidation(folderGR, "dashboard", "org_id = ? AND is_folder = true AND deleted IS NULL"),
			migrations.CountValidation(dashboardGR, "dashboard", "org_id = ? AND is_folder = false AND deleted IS NULL"),
			migrations.FolderTreeValidation(folderGR),
		},
	}
}
