package tounifiedstorage

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/xorm"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const FoldersAndDashboardsMigrationID = "folders and dashboards migration"

type foldersAndDashboardsMigrator struct {
	baseMigrator
	deps *Dependencies
}

func (sp *foldersAndDashboardsMigrator) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	// Check if dependencies are available
	if sp.deps == nil {
		return fmt.Errorf("migration dependencies not initialized")
	}

	// Check if BulkStore is available (GRPC server must be running)
	if sp.deps.BulkStoreClient == nil {
		return fmt.Errorf("BulkStore client not available - unified storage GRPC server may not be running")
	}

	ctx := context.Background()

	// Define resources to migrate
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

	// Create migrator with dependencies
	m := newUnifiedStorageMigrator(sp.deps, resources, "unified-storage-migration.folders-dashboards")

	// Get all organizations to migrate
	orgs, err := sp.getAllOrgs(sess)
	if err != nil {
		return fmt.Errorf("failed to get organizations: %w", err)
	}

	m.log.Info("Starting migration for all organizations", "org_count", len(orgs))

	// Migrate each organization
	for _, org := range orgs {
		namespace := fmt.Sprintf("org-%d", org.ID)
		m.log.Info("Migrating organization", "org_id", org.ID, "org_name", org.Name, "namespace", namespace)

		if err := m.executeMigration(ctx, sess, mg, namespace); err != nil {
			// If validation fails, return error to prevent migration from being marked complete
			return fmt.Errorf("migration failed for org %d (%s): %w", org.ID, org.Name, err)
		}
	}

	m.log.Info("Migration completed successfully for all organizations", "org_count", len(orgs))
	m.log.Info("IMPORTANT: After verifying the migration, update your configuration to enable Mode 5 (unified storage only)")
	m.log.Info("Set dualWriterMode=5 for dashboard.grafana.app and folder.grafana.app resources in your configuration")
	return nil
}

// orgInfo holds organization information for migration
type orgInfo struct {
	ID   int64
	Name string
}

// getAllOrgs retrieves all organizations from the legacy database
func (sp *foldersAndDashboardsMigrator) getAllOrgs(sess *xorm.Session) ([]orgInfo, error) {
	var orgs []orgInfo
	err := sess.Table("org").Cols("id", "name").Find(&orgs)
	if err != nil {
		return nil, err
	}
	return orgs, nil
}
