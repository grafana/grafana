package snapshot

import (
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/snapshot/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
)

func SnapshotMigration(migrator migrator.SnapshotMigrator) migrations.MigrationDefinition {
	snapshotGR := schema.GroupResource{Group: dashV0.APIGroup, Resource: "snapshots"}

	return migrations.MigrationDefinition{
		ID:          "snapshots",
		MigrationID: "snapshots migration",
		Resources: []migrations.ResourceInfo{
			{GroupResource: snapshotGR, LockTables: []string{"dashboard_snapshot"}},
		},
		Migrators: map[schema.GroupResource]migrations.MigratorFunc{
			snapshotGR: migrator.MigrateSnapshots,
		},
		Validators: []migrations.ValidatorFactory{
			migrations.CountValidation(snapshotGR, migrations.CountValidationOptions{
				Table: "dashboard_snapshot",
				Where: "org_id = ?",
			}),
		},
		RenameTables: []string{},
	}
}
