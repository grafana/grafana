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
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/xorm"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// MigrationRunnerOption is a functional option for configuring MigrationRunner.
type MigrationRunnerOption func(*MigrationRunner)

// WithAutoEnableMode5 configures the runner to auto-enable mode 5 after successful migration.
func WithAutoEnableMode5(cfg *setting.Cfg) MigrationRunnerOption {
	return func(r *MigrationRunner) {
		r.cfg = cfg
		r.autoEnableMode5 = true
	}
}

// MigrationRunner executes migrations without implementing the SQL migration interface.
type MigrationRunner struct {
	unifiedMigrator UnifiedMigrator
	cfg             *setting.Cfg
	autoEnableMode5 bool
	log             log.Logger
	resources       []schema.GroupResource
	validators      []Validator
}

// NewMigrationRunner creates a new migration runner.
func NewMigrationRunner(unifiedMigrator UnifiedMigrator, migrationID string, resources []schema.GroupResource, validators []Validator, opts ...MigrationRunnerOption) *MigrationRunner {
	r := &MigrationRunner{
		unifiedMigrator: unifiedMigrator,
		log:             log.New("storage.unified.migration_runner." + migrationID),
		resources:       resources,
		validators:      validators,
	}
	for _, opt := range opts {
		opt(r)
	}
	return r
}

// RunOptions configures a migration run.
type RunOptions struct {
	DriverName string
}

// Run executes the migration logic for all organizations.
func (r *MigrationRunner) Run(ctx context.Context, sess *xorm.Session, opts RunOptions) error {
	orgs, err := r.getAllOrgs(sess)
	if err != nil {
		r.log.Error("failed to get organizations", "error", err)
		return fmt.Errorf("failed to get organizations: %w", err)
	}

	if len(orgs) == 0 {
		r.log.Info("No organizations found to migrate, skipping migration")
		return nil
	}

	r.log.Info("Starting migration for all organizations", "org_count", len(orgs), "resources", r.resources)

	if opts.DriverName == migrator.SQLite {
		// reuse transaction in SQLite to avoid "database is locked" errors
		tx, err := sess.Tx()
		if err != nil {
			r.log.Error("Failed to get transaction from session", "error", err)
			return fmt.Errorf("failed to get transaction: %w", err)
		}
		ctx = resource.ContextWithTransaction(ctx, tx.Tx)
		r.log.Info("Stored migrator transaction in context for bulk operations (SQLite compatibility)")
	}

	for _, org := range orgs {
		info, err := types.ParseNamespace(types.OrgNamespaceFormatter(org.ID))
		if err != nil {
			r.log.Error("Failed to parse organization namespace", "org_id", org.ID, "error", err)
			return fmt.Errorf("failed to parse namespace for org %d: %w", org.ID, err)
		}
		if err = r.MigrateOrg(ctx, sess, info, opts); err != nil {
			return err
		}
	}

	// Auto-enable mode 5 for resources after successful migration
	if r.autoEnableMode5 && r.cfg != nil {
		for _, gr := range r.resources {
			r.log.Info("Auto-enabling mode 5 for resource", "resource", gr.Resource+"."+gr.Group)
			r.cfg.EnableMode5(gr.Resource + "." + gr.Group)
		}
	}

	r.log.Info("Migration completed successfully for all organizations", "org_count", len(orgs))

	return nil
}

// MigrateOrg handles migration for a single organization.
func (r *MigrationRunner) MigrateOrg(ctx context.Context, sess *xorm.Session, info types.NamespaceInfo, opts RunOptions) error {
	r.log.Info("Migrating organization", "org_id", info.OrgID, "namespace", info.Value)

	// Create a service identity context for this namespace to authenticate with unified storage
	ctx = identity.WithServiceIdentityForSingleNamespaceContext(ctx, info.Value)

	startTime := time.Now()

	migrateOpts := legacy.MigrateOptions{
		Namespace:   info.Value,
		Resources:   r.resources,
		WithHistory: true, // Migrate with full history
		Progress: func(count int, msg string) {
			r.log.Info("Migration progress", "org_id", info.OrgID, "count", count, "message", msg)
		},
	}

	// Execute the migration via legacy migrator
	response, err := r.unifiedMigrator.Migrate(ctx, migrateOpts)
	if err != nil {
		r.log.Error("Migration failed", "org_id", info.OrgID, "error", err, "duration", time.Since(startTime))
		return fmt.Errorf("migration failed for org %d (%s): %w", info.OrgID, info.Value, err)
	}
	if response.Error != nil {
		r.log.Error("Migration reported error", "org_id", info.OrgID, "error", response.Error.String(), "duration", time.Since(startTime))
		return fmt.Errorf("migration failed for org %d (%s): %w", info.OrgID, info.Value, fmt.Errorf("migration error: %s", response.Error.Message))
	}

	// Validate the migration results
	if err := r.validateMigration(ctx, sess, response, r.validators); err != nil {
		r.log.Error("Migration validation failed", "org_id", info.OrgID, "error", err, "duration", time.Since(startTime))
		return fmt.Errorf("migration validation failed for org %d (%s): %w", info.OrgID, info.Value, err)
	}

	r.log.Info("Migration completed for organization",
		"org_id", info.OrgID,
		"duration", time.Since(startTime),
		"processed", response.Processed,
		"summaries", len(response.Summary),
		"rejected", len(response.Rejected))

	return nil
}

// validateMigration runs all validators in sequence.
func (r *MigrationRunner) validateMigration(ctx context.Context, sess *xorm.Session, response *resourcepb.BulkResponse, validators []Validator) error {
	if len(validators) == 0 {
		r.log.Debug("No validators provided, skipping validation")
		return nil
	}

	for _, validator := range validators {
		r.log.Debug("Running validator", "name", validator.Name(), "total", len(validators))
		if err := validator.Validate(ctx, sess, response, r.log); err != nil {
			return fmt.Errorf("validator %s failed: %w", validator.Name(), err)
		}
	}

	r.log.Debug("All validators passed", "count", len(validators))
	return nil
}

// getAllOrgs retrieves all organizations from the database.
func (r *MigrationRunner) getAllOrgs(sess *xorm.Session) ([]orgInfo, error) {
	var orgs []orgInfo
	err := sess.Table("org").Cols("id", "name").Find(&orgs)
	if err != nil {
		return nil, err
	}
	return orgs, nil
}

// ResourceMigration handles migration of specific resource types from legacy to unified storage.
// It implements the SQL migration interface and delegates to MigrationRunner for the actual logic.
type ResourceMigration struct {
	migrator.MigrationBase
	runner      *MigrationRunner
	resources   []schema.GroupResource
	migrationID string
	autoMigrate bool // If true, auto-migrate resource if count is below threshold
	hadErrors   bool // Tracks if errors occurred during migration (used with ignoreErrors)
}

// ResourceMigrationOption is a functional option for configuring ResourceMigration.
type ResourceMigrationOption func(*ResourceMigration, *MigrationRunner)

// WithAutoMigrate configures the migration to auto-migrate resource if count is below threshold.
func WithAutoMigrate(cfg *setting.Cfg) ResourceMigrationOption {
	return func(m *ResourceMigration, r *MigrationRunner) {
		m.autoMigrate = true
		r.cfg = cfg
		r.autoEnableMode5 = true
	}
}

// NewResourceMigration creates a new migration for the specified resources.
// It internally creates a MigrationRunner to handle the actual migration logic.
func NewResourceMigration(
	unifiedMigrator UnifiedMigrator,
	resources []schema.GroupResource,
	migrationID string,
	validators []Validator,
	opts ...ResourceMigrationOption,
) *ResourceMigration {
	runner := NewMigrationRunner(unifiedMigrator, migrationID, resources, validators)
	m := &ResourceMigration{
		runner:      runner,
		resources:   resources,
		migrationID: migrationID,
	}
	for _, opt := range opts {
		opt(m, runner)
	}
	return m
}

func (m *ResourceMigration) SkipMigrationLog() bool {
	// Skip populating the log table if auto-migrate is enabled and errors occurred
	return m.autoMigrate && m.hadErrors
}

var _ migrator.CodeMigration = (*ResourceMigration)(nil)

// SQL implements migrator.Migration interface. Returns a description string.
func (m *ResourceMigration) SQL(_ migrator.Dialect) string {
	return fmt.Sprintf("unified storage data migration: %s", m.migrationID)
}

// Exec implements migrator.CodeMigration interface. Executes the migration across all organizations.
// It delegates to the internal MigrationRunner for the actual migration logic.
func (m *ResourceMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) (err error) {
	// Track any errors that occur during migration
	defer func() {
		if err != nil {
			if m.autoMigrate {
				m.runner.log.Warn(
					`[WARN] Resource migration failed and is currently skipped.
This migration will be enforced in the next major Grafana release, where failures will block startup or resource loading.

This warning is intended to help you detect and report issues early.
Please investigate the failure and report it to the Grafana team so it can be addressed before the next major release.`,
					"error", err)
			}
			m.hadErrors = true
		}
	}()

	ctx := context.Background()

	return m.runner.Run(ctx, sess, RunOptions{
		DriverName: mg.Dialect.DriverName(),
	})
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
