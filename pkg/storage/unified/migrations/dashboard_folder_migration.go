package migrations

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	FoldersAndDashboardsMigrationID = "folders and dashboards migration"
	CodeMigrationSQL                = "code migration"
)

type foldersAndDashboardsMigrator struct {
	migrator.MigrationBase
	legacyMigrator  legacy.LegacyMigrator
	bulkStoreClient resourcepb.BulkStoreClient
}

var _ migrator.CodeMigration = (*foldersAndDashboardsMigrator)(nil)

// SQL implements migrator.Migration interface. Returns a description string.
func (sp *foldersAndDashboardsMigrator) SQL(dialect migrator.Dialect) string {
	return CodeMigrationSQL
}

func (sp *foldersAndDashboardsMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	ctx := context.Background()

	resources := []schema.GroupResource{
		{
			Group:    "folder.grafana.app",
			Resource: "folders",
		},
		{
			Group:    "dashboard.grafana.app",
			Resource: "dashboards",
		},
	}

	mig := newUnifiedStorageMigrator(sp.legacyMigrator, sp.bulkStoreClient, resources, "unified-storage-migration.folders-dashboards")

	orgs, err := sp.getAllOrgs(sess)
	if err != nil {
		return fmt.Errorf("failed to get organizations: %w", err)
	}

	mig.log.Info("Starting migration for all organizations", "org_count", len(orgs))

	for _, org := range orgs {
		namespace := fmt.Sprintf("org-%d", org.ID)
		mig.log.Info("Migrating organization", "org_id", org.ID, "org_name", org.Name, "namespace", namespace)

		if err := mig.executeMigration(ctx, sess, mg, namespace); err != nil {
			return fmt.Errorf("migration failed for org %d (%s): %w", org.ID, org.Name, err)
		}
	}

	mig.log.Info("Migration completed successfully for all organizations", "org_count", len(orgs))
	mig.log.Info("IMPORTANT: After verifying the migration, update your configuration to enable Mode 5 (unified storage only)")
	mig.log.Info("Set dualWriterMode=5 for dashboard.grafana.app and folder.grafana.app resources in your configuration")
	return nil
}

type orgInfo struct {
	ID   int64
	Name string
}

func (sp *foldersAndDashboardsMigrator) getAllOrgs(sess *xorm.Session) ([]orgInfo, error) {
	var orgs []orgInfo
	err := sess.Table("org").Cols("id", "name").Find(&orgs)
	if err != nil {
		return nil, err
	}
	return orgs, nil
}
