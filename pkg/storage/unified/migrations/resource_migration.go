package migrations

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// ValidationFunc is a function that validates migration results.
// It receives the context, resource client for querying unified storage, database session for legacy queries,
// migration response, and logger for reporting.
// Return an error if validation fails, nil if validation passes or is skipped.
type ValidationFunc func(ctx context.Context, client resourcepb.ResourceIndexClient, sess *xorm.Session, response *resourcepb.BulkResponse, log log.Logger) error

// ResourceMigration handles migration of specific resource types from legacy to unified storage.
// It implements migrator.CodeMigration and provides a generic, extensible way to migrate any
// resource type by:
//
//  1. Iterating through all organizations
//  2. For each org, delegating to LegacyMigrator to read from legacy and write to unified storage
//  3. Validating migration results using the provided validation function (if any)
//
// To add a new resource type migration, simply create a new ResourceMigration instance in
// service.go with the appropriate schema.GroupResource specifications and optional validation function.
type ResourceMigration struct {
	migrator.MigrationBase
	migrator       UnifiedMigrator
	resources      []schema.GroupResource
	migrationID    string
	validationFunc ValidationFunc // Optional: custom validation logic for this migration
	client         resourcepb.ResourceIndexClient
	log            log.Logger
}

// NewResourceMigration creates a new migration for the specified resources.
// This is the primary way to register new resource migrations.
//
// Parameters:
//   - legacyMigrator: handles reading from legacy storage and writing to unified storage
//   - resources: list of GroupResource to migrate
//   - migrationID: unique identifier for this migration
//   - validationFunc: optional validation function to verify migration results.
//     If nil, no validation will be performed.
//   - client: resource client for validation queries to unified storage
//
// Example with legacy table count validation:
//
//	NewResourceMigration(
//	    migrator,
//	    []schema.GroupResource{{Group: "playlist.grafana.app", Resource: "playlists"}},
//	    "playlists",
//	    NewLegacyTableCountValidator(map[string]LegacyTableInfo{
//	        "playlist.grafana.app/playlists": {Table: "playlist", WhereClause: "org_id = ?"},
//	    }),
//	    client,
//	)
//
// Example without validation:
//
//	NewResourceMigration(migrator, resources, "new-resource", nil, client)
func NewResourceMigration(
	migrator UnifiedMigrator,
	resources []schema.GroupResource,
	migrationID string,
	validationFunc ValidationFunc,
	client resourcepb.ResourceIndexClient,
) *ResourceMigration {
	return &ResourceMigration{
		migrator:       migrator,
		resources:      resources,
		migrationID:    migrationID,
		validationFunc: validationFunc,
		client:         client,
		log:            log.New("storage.unified.resource_migration." + migrationID),
	}
}

var _ migrator.CodeMigration = (*ResourceMigration)(nil)

// SQL implements migrator.Migration interface. Returns a description string.
func (m *ResourceMigration) SQL(_ migrator.Dialect) string {
	return fmt.Sprintf("unified storage data migration: %s", m.migrationID)
}

// Exec implements migrator.CodeMigration interface. Executes the migration across all organizations.
func (m *ResourceMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	ctx := context.Background()

	orgs, err := m.getAllOrgs(sess)
	if err != nil {
		m.log.Error("failed to get organizations", "error", err)
		return fmt.Errorf("failed to get organizations: %w", err)
	}

	if len(orgs) == 0 {
		m.log.Info("No organizations found to migrate, skipping migration")
		return nil
	}

	m.log.Info("Starting migration for all organizations", "org_count", len(orgs), "resources", m.resources)

	for _, org := range orgs {
		if err := m.migrateOrg(ctx, sess, org); err != nil {
			return err
		}
	}

	m.log.Info("Migration completed successfully for all organizations", "org_count", len(orgs))
	return nil
}

// migrateOrg handles migration for a single organization
func (m *ResourceMigration) migrateOrg(ctx context.Context, sess *xorm.Session, org orgInfo) error {
	namespace := types.OrgNamespaceFormatter(org.ID)
	m.log.Info("Migrating organization", "org_id", org.ID, "org_name", org.Name, "namespace", namespace)

	// Create a service identity context for this namespace to authenticate with unified storage
	migrationCtx, _ := identity.WithServiceIdentityForSingleNamespace(ctx, namespace)

	startTime := time.Now()

	opts := legacy.MigrateOptions{
		Namespace:   namespace,
		Resources:   m.resources,
		WithHistory: true, // Migrate with full history
		Progress: func(count int, msg string) {
			m.log.Info("Migration progress", "org_id", org.ID, "count", count, "message", msg)
		},
	}

	// Execute the migration via legacy migrator
	response, err := m.migrator.Migrate(migrationCtx, opts)
	if err != nil {
		m.log.Error("Migration failed", "org_id", org.ID, "error", err, "duration", time.Since(startTime))
		return fmt.Errorf("migration failed for org %d (%s): %w", org.ID, org.Name, err)
	}

	// Validate the migration results
	if err := m.validateMigration(migrationCtx, sess, response); err != nil {
		m.log.Error("Migration validation failed", "org_id", org.ID, "error", err, "duration", time.Since(startTime))
		return fmt.Errorf("migration validation failed for org %d (%s): %w", org.ID, org.Name, err)
	}

	m.log.Info("Migration completed for organization",
		"org_id", org.ID,
		"duration", time.Since(startTime),
		"processed", response.Processed,
		"summaries", len(response.Summary),
		"rejected", len(response.Rejected))

	return nil
}

// validateMigration calls the custom validation function if provided
func (m *ResourceMigration) validateMigration(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse) error {
	if m.validationFunc == nil {
		m.log.Debug("No validation function provided, skipping validation")
		return nil
	}

	return m.validationFunc(ctx, m.client, sess, response, m.log)
}

// LegacyTableInfo defines how to map a unified storage resource to its legacy table
type LegacyTableInfo struct {
	Table       string // Legacy table name (e.g., "dashboard", "playlist")
	WhereClause string // WHERE clause template with org_id parameter (e.g., "org_id = ? and is_folder = false")
}

// NewCountValidator creates a ValidationFunc that validates migration by comparing
// counts between legacy tables and unified storage using the GetStats API.
//
// This is a helper for the common case of validating that all items from legacy tables
// were successfully migrated to unified storage. It queries unified storage using GetStats
// to verify the actual indexed count matches the legacy table count.
//
// Parameters:
//   - legacyTableMap: maps "group/resource" keys to LegacyTableInfo for validation.
//     Only resources with mappings will be validated.
//
// Example:
//
//	validator := NewCountValidator(map[string]LegacyTableInfo{
//	    "dashboard.grafana.app/dashboards": {Table: "dashboard", WhereClause: "org_id = ? and is_folder = false"},
//	    "folder.grafana.app/folders": {Table: "dashboard", WhereClause: "org_id = ? and is_folder = true"},
//	})
func NewCountValidator(legacyTableMap map[string]LegacyTableInfo) ValidationFunc {
	return func(ctx context.Context, client resourcepb.ResourceIndexClient, sess *xorm.Session, response *resourcepb.BulkResponse, log log.Logger) error {
		// Check for rejected items
		if len(response.Rejected) > 0 {
			log.Warn("Migration had rejected items", "count", len(response.Rejected))
			for i, rejected := range response.Rejected {
				if i < 10 { // Log first 10 rejected items
					log.Warn("Rejected item",
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
			key := fmt.Sprintf("%s/%s", summary.Group, summary.Resource)
			tableInfo, ok := legacyTableMap[key]
			if !ok {
				log.Debug("No legacy table mapping for resource, skipping count validation",
					"resource", fmt.Sprintf("%s.%s", summary.Resource, summary.Group),
					"namespace", summary.Namespace)
				continue
			}

			// Get legacy count from database
			orgID, err := ParseOrgIDFromNamespace(summary.Namespace)
			if err != nil {
				return fmt.Errorf("invalid namespace %s: %w", summary.Namespace, err)
			}

			legacyCount, err := sess.Table(tableInfo.Table).Where(tableInfo.WhereClause, orgID).Count()
			if err != nil {
				return fmt.Errorf("failed to count %s: %w", tableInfo.Table, err)
			}

			// Get unified storage count using GetStats API
			statsResp, err := client.GetStats(ctx, &resourcepb.ResourceStatsRequest{
				Namespace: summary.Namespace,
				Kinds:     []string{fmt.Sprintf("%s/%s", summary.Group, summary.Resource)},
			})
			if err != nil {
				return fmt.Errorf("failed to get stats for %s/%s in namespace %s: %w",
					summary.Group, summary.Resource, summary.Namespace, err)
			}

			// Find the count for this specific resource type
			var unifiedCount int64
			for _, stat := range statsResp.Stats {
				if stat.Group == summary.Group && stat.Resource == summary.Resource {
					unifiedCount = stat.Count
					break
				}
			}

			// Account for rejected items in validation
			expectedCount := unifiedCount + int64(len(response.Rejected))

			log.Info("Count validation",
				"resource", fmt.Sprintf("%s.%s", summary.Resource, summary.Group),
				"namespace", summary.Namespace,
				"legacy_count", legacyCount,
				"unified_count", unifiedCount,
				"migration_summary_count", summary.Count,
				"rejected", len(response.Rejected),
				"history", summary.History)

			// Validate that we migrated all items (allowing for rejected items)
			if legacyCount > expectedCount {
				return fmt.Errorf("count mismatch for %s.%s in namespace %s: legacy has %d, unified has %d, rejected %d",
					summary.Resource, summary.Group, summary.Namespace,
					legacyCount, unifiedCount, len(response.Rejected))
			}
		}

		return nil
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

// orgInfo represents basic organization information
type orgInfo struct {
	ID   int64  `xorm:"id"`
	Name string `xorm:"name"`
}

// getAllOrgs retrieves all organizations from the database
func (m *ResourceMigration) getAllOrgs(sess *xorm.Session) ([]orgInfo, error) {
	var orgs []orgInfo
	err := sess.Table("org").Cols("id", "name").Find(&orgs)
	if err != nil {
		return nil, err
	}
	return orgs, nil
}
