package migrations

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// StorageMigrator defines the interface for executing unified storage migrations
type StorageMigrator interface {
	executeMigration(ctx context.Context, sess *xorm.Session, mg *migrator.Migrator, namespace string) error
}

type unifiedStorageMigrator struct {
	migrator        legacy.LegacyMigrator
	bulkStoreClient resource.ResourceClient
	resources       []schema.GroupResource
	log             log.Logger
}

func newUnifiedStorageMigrator(migrator legacy.LegacyMigrator, bulkStoreClient resource.ResourceClient, resources []schema.GroupResource, logPrefix string) StorageMigrator {
	return &unifiedStorageMigrator{
		migrator:        migrator,
		bulkStoreClient: bulkStoreClient,
		resources:       resources,
		log:             log.New(logPrefix),
	}
}

func (m *unifiedStorageMigrator) executeMigration(ctx context.Context, sess *xorm.Session, mg *migrator.Migrator, namespace string) error {
	startTime := time.Now()
	m.log.Info("Starting unified storage migration", "namespace", namespace, "resources", m.resources)

	opts := legacy.MigrateOptions{
		Namespace:    namespace,
		Store:        m.bulkStoreClient,
		LargeObjects: nil, // Not using large object support to avoid import cycles
		Resources:    m.resources,
		WithHistory:  true, // Migrate with full history
		OnlyCount:    false,
		Progress: func(count int, msg string) {
			m.log.Info("Migration progress", "count", count, "message", msg)
		},
	}

	// Execute the migration via legacy migrator
	response, err := m.migrator.Migrate(ctx, opts)
	if err != nil {
		m.log.Error("Migration failed", "error", err, "duration", time.Since(startTime))
		return fmt.Errorf("failed to migrate resources: %w", err)
	}

	// Validate the migration results
	if err := m.validateMigration(sess, response); err != nil {
		m.log.Error("Migration validation failed", "error", err, "duration", time.Since(startTime))
		return fmt.Errorf("migration validation failed: %w", err)
	}

	m.log.Info("Migration completed successfully",
		"duration", time.Since(startTime),
		"processed", response.Processed,
		"summaries", len(response.Summary),
		"rejected", len(response.Rejected))

	return nil
}

func (m *unifiedStorageMigrator) validateMigration(sess *xorm.Session, response *resourcepb.BulkResponse) error {
	// Check for rejected items
	if len(response.Rejected) > 0 {
		m.log.Warn("Migration had rejected items", "count", len(response.Rejected))
		for i, rejected := range response.Rejected {
			if i < 10 { // Log first 10 rejected items
				m.log.Warn("Rejected item",
					"namespace", rejected.Key.Namespace,
					"group", rejected.Key.Group,
					"resource", rejected.Key.Resource,
					"name", rejected.Key.Name,
					"reason", rejected.Error)
			}
		}
		// Rejections are not fatal - they may be expected for invalid data
	}

	// Validate counts for each resource type
	for _, summary := range response.Summary {
		legacyCount, err := m.getLegacyCount(sess, summary.Group, summary.Resource, summary.Namespace)
		if err != nil {
			return fmt.Errorf("failed to get legacy count for %s/%s: %w", summary.Group, summary.Resource, err)
		}

		// Account for rejected items in validation
		expectedCount := summary.Count + int64(len(response.Rejected))

		m.log.Info("Count validation",
			"resource", fmt.Sprintf("%s.%s", summary.Resource, summary.Group),
			"namespace", summary.Namespace,
			"legacy_count", legacyCount,
			"unified_count", summary.Count,
			"rejected", len(response.Rejected),
			"history", summary.History)

		// Validate that we migrated all items (allowing for rejected items)
		if legacyCount > expectedCount {
			return fmt.Errorf("count mismatch for %s.%s in namespace %s: legacy has %d, unified has %d, rejected %d",
				summary.Resource, summary.Group, summary.Namespace,
				legacyCount, summary.Count, len(response.Rejected))
		}
	}

	return nil
}

func (m *unifiedStorageMigrator) getLegacyCount(sess *xorm.Session, group, resourceType, namespace string) (int64, error) {
	// Parse namespace to get org ID
	orgID, err := ParseOrgIDFromNamespace(namespace)
	if err != nil {
		return 0, fmt.Errorf("invalid namespace %s: %w", namespace, err)
	}

	// Map group/resource to legacy table
	tableName, whereClause := m.getLegacyTableInfo(group, resourceType)
	if tableName == "" {
		return 0, fmt.Errorf("unknown resource type: %s.%s", resourceType, group)
	}

	// Count items in legacy table using Table() before Count()
	count, err := sess.Table(tableName).Where(whereClause, orgID).Count()
	if err != nil {
		return 0, fmt.Errorf("failed to count %s: %w", tableName, err)
	}

	return count, nil
}

func (m *unifiedStorageMigrator) getLegacyTableInfo(group, resource string) (table string, whereClause string) {
	// Map unified storage group/resource to legacy tables
	switch {
	case group == "dashboard.grafana.app" && resource == "dashboards":
		return "dashboard", "org_id = ? and is_folder = false"
	case group == "folder.grafana.app" && resource == "folders":
		return "dashboard", "org_id = ? and is_folder = true"
	case group == "playlist.grafana.app" && resource == "playlists":
		return "playlist", "org_id = ?"
	default:
		return "", ""
	}
}

func ParseOrgIDFromNamespace(namespace string) (int64, error) {
	// Use authlib to properly parse all namespace formats including "default" for org 1
	info, err := types.ParseNamespace(namespace)
	if err != nil {
		return 0, fmt.Errorf("failed to parse namespace: %w", err)
	}
	return info.OrgID, nil
}
