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

type Validator interface {
	Validate(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse, log log.Logger) error
}

// ResourceMigration handles migration of specific resource types from legacy to unified storage.
type ResourceMigration struct {
	migrator.MigrationBase
	migrator    UnifiedMigrator
	resources   []schema.GroupResource
	migrationID string
	validator   Validator // Optional: custom validation logic for this migration
	log         log.Logger
}

// NewResourceMigration creates a new migration for the specified resources.
func NewResourceMigration(
	migrator UnifiedMigrator,
	resources []schema.GroupResource,
	migrationID string,
	validator Validator,
) *ResourceMigration {
	return &ResourceMigration{
		migrator:    migrator,
		resources:   resources,
		migrationID: migrationID,
		validator:   validator,
		log:         log.New("storage.unified.resource_migration." + migrationID),
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
	if m.validator == nil {
		m.log.Debug("No validation function provided, skipping validation")
		return nil
	}

	return m.validator.Validate(ctx, sess, response, m.log)
}

// LegacyTableInfo defines how to map a unified storage resource to its legacy table
type LegacyTableInfo struct {
	Table       string // Legacy table name (e.g., "dashboard", "playlist")
	WhereClause string // WHERE clause template with org_id parameter (e.g., "org_id = ? and is_folder = false")
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
