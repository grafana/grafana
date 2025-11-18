package migrations

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util/xorm"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	FoldersAndDashboardsMigrationID = "folders and dashboards migration"
	UnifiedStorageDataMigrationSQL  = "unified storage data migration"
)

type dashboardAndFolderMigration struct {
	migrator.MigrationBase
	legacyMigrator  legacy.LegacyMigrator
	bulkStoreClient resource.ResourceClient
}

var _ migrator.CodeMigration = (*dashboardAndFolderMigration)(nil)

// SQL implements migrator.Migration interface. Returns a description string.
func (sp *dashboardAndFolderMigration) SQL(dialect migrator.Dialect) string {
	return UnifiedStorageDataMigrationSQL
}

func (sp *dashboardAndFolderMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	ctx := context.Background()
	logger := mg.Logger

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

	storageMigrator := newUnifiedStorageMigrator(sp.legacyMigrator, sp.bulkStoreClient, resources, "unified-storage-migration.folders-dashboards")

	orgs, err := sp.getAllOrgs(sess)
	if err != nil {
		logger.Error("failed to get organizations for folders and dashboards migration", "error", err)
		return fmt.Errorf("failed to get organizations: %w", err)
	}

	if len(orgs) == 0 {
		logger.Info("No organizations found to migrate, skipping migration")
		return nil
	}

	logger.Info("Starting migration for all organizations", "org_count", len(orgs))

	for _, org := range orgs {
		namespace := types.OrgNamespaceFormatter(org.ID)
		logger.Info("Migrating organization", "org_id", org.ID, "org_name", org.Name, "namespace", namespace)

		// Create a service identity context for this namespace to authenticate with unified storage
		migrationCtx, _ := identity.WithServiceIdentityForSingleNamespace(ctx, namespace)

		if err := storageMigrator.executeMigration(migrationCtx, sess, mg, namespace); err != nil {
			logger.Error("migration failed for organization", "org_id", org.ID, "org_name", org.Name, "error", err)
			return fmt.Errorf("migration failed for org %d (%s): %w", org.ID, org.Name, err)
		}
	}

	logger.Info("Migration completed successfully for all organizations", "org_count", len(orgs))
	return nil
}

type orgInfo struct {
	ID   int64  `xorm:"id"`
	Name string `xorm:"name"`
}

func (sp *dashboardAndFolderMigration) getAllOrgs(sess *xorm.Session) ([]orgInfo, error) {
	var orgs []orgInfo
	err := sess.Table("org").Cols("id", "name").Find(&orgs)
	if err != nil {
		return nil, err
	}
	return orgs, nil
}
