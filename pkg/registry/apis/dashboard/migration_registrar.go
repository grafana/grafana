package dashboard

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	v1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	foldersV1beta1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
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
			{
				GroupResource: folderGR,
				LockTables:    []string{"dashboard", "dashboard_version", "dashboard_provisioning"},
				// Earlier migrations left folders as v1beta1 and do not re-run.
				FloorVersion: foldersV1beta1.APIVersion,
			},
			{
				GroupResource: dashboardGR,
				LockTables:    []string{"dashboard", "dashboard_version", "dashboard_provisioning"},
				FloorVersion:  dashV0.VERSION,
			},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			folderGR:    migrator.MigrateFolders,
			dashboardGR: migrator.MigrateDashboards,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(folderGR, migrations.CountValidationOptions{
				Table: "dashboard",
				// Provisioned rows are excluded from the migration query (query_dashboards.sql),
				// so they must also be excluded here or the counts would never match.
				Where: "org_id = ? AND is_folder = true AND deleted IS NULL AND NOT EXISTS (SELECT 1 FROM dashboard_provisioning WHERE dashboard_provisioning.dashboard_id = dashboard.id)",
			}),
			migrations.CountValidation(dashboardGR, migrations.CountValidationOptions{
				Table: "dashboard",
				// Provisioned rows are excluded from the migration query (query_dashboards.sql),
				// so they must also be excluded here or the counts would never match.
				Where: "org_id = ? AND is_folder = false AND deleted IS NULL AND NOT EXISTS (SELECT 1 FROM dashboard_provisioning WHERE dashboard_provisioning.dashboard_id = dashboard.id)",
			}),
			migrations.FolderTreeValidation(folderGR),
		},
		// Folder and Dashboard tables are still being used
		RenameTables: []string{},
	}
}
