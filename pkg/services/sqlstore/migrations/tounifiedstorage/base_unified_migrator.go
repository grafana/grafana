package tounifiedstorage

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// LargeObjectSupport is a minimal interface for handling large objects
// This is defined locally to avoid import cycles with apistore
type LargeObjectSupport interface {
	GroupResource() schema.GroupResource
	Threshold() int
}

// MigrateOptions holds options for legacy migration
// This is defined locally to avoid import cycles
type MigrateOptions struct {
	Namespace    string
	Store        resourcepb.BulkStoreClient
	LargeObjects LargeObjectSupport // Optional - can be nil
	Resources    []schema.GroupResource
	WithHistory  bool
	OnlyCount    bool
	StackID      string
	Progress     func(count int, msg string)
}

// Dependencies holds the required dependencies for unified storage migrations
type Dependencies struct {
	LegacyMigrator  LegacyMigrator
	BulkStoreClient resourcepb.BulkStoreClient
}

type ResourceClient interface {
	resourcepb.BulkStoreClient
}

// unifiedStorageMigrator is the base for all unified storage data migrations
type unifiedStorageMigrator struct {
	baseMigrator
	deps      *Dependencies
	resources []schema.GroupResource
	log       log.Logger
}

// newUnifiedStorageMigrator creates a new unified storage migrator instance
func newUnifiedStorageMigrator(deps *Dependencies, resources []schema.GroupResource, logPrefix string) *unifiedStorageMigrator {
	return &unifiedStorageMigrator{
		deps:      deps,
		resources: resources,
		log:       log.New(logPrefix),
	}
}

// executeMigration runs the migration for all configured resources
func (m *unifiedStorageMigrator) executeMigration(ctx context.Context, sess *xorm.Session, mg *migrator.Migrator, namespace string) error {
	startTime := time.Now()
	m.log.Info("Starting unified storage migration", "namespace", namespace, "resources", m.resources)

	// Prepare migration options
	opts := MigrateOptions{
		Namespace:    namespace,
		Store:        m.deps.BulkStoreClient,
		LargeObjects: nil, // Not using large object support to avoid import cycles
		Resources:    m.resources,
		WithHistory:  true, // Migrate with full history
		OnlyCount:    false,
		StackID:      "onprem",
		Progress: func(count int, msg string) {
			m.log.Info("Migration progress", "count", count, "message", msg)
		},
	}

	// Execute the migration via legacy migrator
	response, err := m.deps.LegacyMigrator.Migrate(ctx, opts)
	if err != nil {
		m.log.Error("Migration failed", "error", err, "duration", time.Since(startTime))
		return fmt.Errorf("failed to migrate resources: %w", err)
	}

	// Validate the migration results
	if err := m.validateMigrationResults(ctx, sess, response); err != nil {
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

// validateMigrationResults validates the migration by comparing counts
func (m *unifiedStorageMigrator) validateMigrationResults(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse) error {
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

// getLegacyCount retrieves the count of items in the legacy database
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

	// Count items in legacy table
	count, err := sess.Where(whereClause, orgID).Count(tableName)
	if err != nil {
		return 0, fmt.Errorf("failed to count %s: %w", tableName, err)
	}

	return count, nil
}

// getLegacyTableInfo returns the table name and where clause for a given resource type
func (m *unifiedStorageMigrator) getLegacyTableInfo(group, resource string) (table string, whereClause string) {
	// Map unified storage group/resource to legacy tables
	switch {
	case group == "dashboard.grafana.app" && resource == "dashboards":
		return "dashboard", "org_id = ?"
	case group == "folder.grafana.app" && resource == "folders":
		return "folder", "org_id = ?"
	case group == "playlist.grafana.app" && resource == "playlists":
		return "playlist", "org_id = ?"
	default:
		return "", ""
	}
}

// ParseOrgIDFromNamespace extracts the org ID from a namespace string
func ParseOrgIDFromNamespace(namespace string) (int64, error) {
	// Namespace format is typically "org-<id>" or "orgId-<id>"
	// For now, assume format is known - this should use authlib.ParseNamespace in practice
	var orgID int64
	n, err := fmt.Sscanf(namespace, "org-%d", &orgID)
	if err != nil || n != 1 {
		// Try alternative format
		n, err = fmt.Sscanf(namespace, "orgId-%d", &orgID)
		if err != nil || n != 1 {
			return 0, fmt.Errorf("invalid namespace format: %s", namespace)
		}
	}
	return orgID, nil
}
