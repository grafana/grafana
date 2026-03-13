package migrations

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/sqlutil"
	migrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// MigrationRunnerOption is a functional option for configuring MigrationRunner.
type MigrationRunnerOption func(*MigrationRunner)

// MigrationRunner executes migrations without implementing the SQL migration interface.
type MigrationRunner struct {
	unifiedMigrator UnifiedMigrator
	tableLocker     MigrationTableLocker
	tableRenamer    MigrationTableRenamer
	definition      MigrationDefinition
	cfg             *setting.Cfg
	log             log.Logger
	resources       []schema.GroupResource
	validators      []Validator
}

// NewMigrationRunner creates a new migration runner.
func NewMigrationRunner(unifiedMigrator UnifiedMigrator, tableLocker MigrationTableLocker, tableRenamer MigrationTableRenamer, cfg *setting.Cfg, def MigrationDefinition, validators []Validator, opts ...MigrationRunnerOption) *MigrationRunner {
	r := &MigrationRunner{
		unifiedMigrator: unifiedMigrator,
		tableLocker:     tableLocker,
		tableRenamer:    tableRenamer,
		cfg:             cfg,
		definition:      def,
		log:             log.New("storage.unified.migration_runner." + def.ID),
		resources:       def.GetGroupResources(),
		validators:      validators,
	}
	for _, opt := range opts {
		opt(r)
	}
	return r
}

// RunOptions configures a migration run.
type RunOptions struct {
	DriverName       string
	UsingDistributor bool
}

// Run executes the migration logic for all organizations.
func (r *MigrationRunner) Run(ctx context.Context, queryer migrator.Queryer, mg *migrator.Migrator, opts RunOptions) error {
	orgs, err := r.getAllOrgs(ctx, queryer)
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
		if tx, ok := queryer.(*sql.Tx); ok {
			// Reuse the migration transaction in SQLite to avoid "database is locked" errors.
			cacheKB := 50000
			if r.cfg.MigrationCacheSizeKB > 0 {
				cacheKB = r.cfg.MigrationCacheSizeKB
			}
			if _, err := tx.ExecContext(ctx, fmt.Sprintf("PRAGMA cache_size = -%d", cacheKB)); err != nil {
				r.log.Warn("Failed to set SQLite cache_size for migration", "error", err)
			}
			ctx = resource.ContextWithTransaction(ctx, tx)
			r.log.Info("Stored migrator transaction in context for bulk operations (SQLite compatibility)")
		}
	}

	r.tableRenamer.Init(queryer, mg)
	if err := r.tableRenamer.RecoverRenamedTables(r.definition.RenameTables); err != nil {
		return fmt.Errorf("failed to recover partial rename: %w", err)
	}
	lockTables := r.definition.GetLockTables()

	// Skip migration if the table does not exist
	// This is common for deployments that stop creating the legacy table for new instances
	if r.definition.SkipWhenMissing {
		for _, table := range lockTables {
			found, err := sqlutil.TableExists(ctx, mg.SqlDB(), mg.Dialect, table)
			if err != nil {
				return fmt.Errorf("failed to check if table exists (%s): %w", table, err)
			}
			if !found {
				r.log.Info("Migration is not required, the legacy SQL table does not exist", "table", table)
				return nil
			}
		}
	}

	unlockTables, err := r.tableLocker.LockMigrationTables(ctx, queryer, mg, lockTables)
	if err != nil {
		return fmt.Errorf("failed to lock tables for migration: %w", err)
	}
	defer func() {
		if err := unlockTables(ctx); err != nil {
			r.log.Error("error unlocking legacy tables", "error", err)
		}
	}()

	if err := r.migrateAllOrgs(ctx, queryer, mg, orgs, opts); err != nil {
		if opts.DriverName != migrator.SQLite {
			return err
		}
		r.log.Warn("SQLite migration failed, retrying with parquet buffer", "error", err)
		ctx = resource.ContextWithParquetBuffer(ctx)
		if err := r.migrateAllOrgs(ctx, queryer, mg, orgs, opts); err != nil {
			return err
		}
	}

	if !r.cfg.DisableLegacyTableRename {
		if err := r.tableRenamer.RenameTables(ctx, r.definition.RenameTables, unlockTables); err != nil {
			return err
		}
	}

	r.log.Info("Migration completed successfully for all organizations", "org_count", len(orgs))

	return nil
}

func (r *MigrationRunner) migrateAllOrgs(ctx context.Context, queryer migrator.Queryer, mg *migrator.Migrator, orgs []orgInfo, opts RunOptions) error {
	for _, org := range orgs {
		info, err := types.ParseNamespace(types.OrgNamespaceFormatter(org.ID))
		if err != nil {
			r.log.Error("Failed to parse organization namespace", "org_id", org.ID, "error", err)
			return fmt.Errorf("failed to parse namespace for org %d: %w", org.ID, err)
		}
		if err = r.MigrateOrg(ctx, queryer, mg, info, opts); err != nil {
			return err
		}
	}
	return nil
}

// MigrateOrg handles migration for a single organization.
func (r *MigrationRunner) MigrateOrg(ctx context.Context, queryer migrator.Queryer, mg *migrator.Migrator, info types.NamespaceInfo, opts RunOptions) error {
	r.log.Info("Migrating organization", "org_id", info.OrgID, "namespace", info.Value)

	// Create a service identity context for this namespace to authenticate with unified storage
	ctx = identity.WithServiceIdentityForSingleNamespaceContext(ctx, info.Value)

	startTime := time.Now()

	migrateOpts := MigrateOptions{
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

	migrationFinishedAt := time.Now()

	err = r.unifiedMigrator.RebuildIndexes(ctx, RebuildIndexOptions{
		UsingDistributor:    opts.UsingDistributor,
		NamespaceInfo:       info,
		Resources:           r.resources,
		MigrationFinishedAt: migrationFinishedAt,
	})
	if err != nil {
		r.log.Error("Rebuilding indexes failed", "org_id", info.OrgID, "error", err, "duration", time.Since(startTime))
		return fmt.Errorf("rebuilding indexes failed for org %d (%s): %w", info.OrgID, info.Value, err)
	}

	// On MySQL with rename, use a separate session so validator SELECTs don't hold
	// shared MDL on sess's transaction (would deadlock with RENAME's exclusive MDL).
	validationQueryer := queryer
	if opts.DriverName == migrator.MySQL && len(r.definition.RenameTables) > 0 && !r.cfg.DisableLegacyTableRename {
		conn, err := mg.SqlDB().Conn(ctx)
		if err != nil {
			return fmt.Errorf("open validator connection: %w", err)
		}
		defer func() { _ = conn.Close() }()
		validationQueryer = conn
	}
	if err := r.validateMigration(ctx, validationQueryer, response, r.validators); err != nil {
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
func (r *MigrationRunner) validateMigration(ctx context.Context, queryer migrator.Queryer, response *resourcepb.BulkResponse, validators []Validator) error {
	if len(validators) == 0 {
		r.log.Debug("No validators provided, skipping validation")
		return nil
	}

	for _, validator := range validators {
		r.log.Debug("Running validator", "name", validator.Name(), "total", len(validators))
		if err := validator.Validate(ctx, queryer, response, r.log); err != nil {
			return fmt.Errorf("validator %s failed: %w", validator.Name(), err)
		}
	}

	r.log.Debug("All validators passed", "count", len(validators))
	return nil
}

// getAllOrgs retrieves all organizations from the database.
func (r *MigrationRunner) getAllOrgs(ctx context.Context, queryer migrator.Queryer) ([]orgInfo, error) {
	rows, err := queryer.QueryContext(ctx, "SELECT id, name FROM org")
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	orgs := make([]orgInfo, 0)
	for rows.Next() {
		org := orgInfo{}
		if err := rows.Scan(&org.ID, &org.Name); err != nil {
			return nil, err
		}
		orgs = append(orgs, org)
	}
	if err := rows.Err(); err != nil {
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
}

// ResourceMigrationOption is a functional option for configuring ResourceMigration.
type ResourceMigrationOption func(*ResourceMigration, *MigrationRunner)

// NewResourceMigration creates a new migration for the specified resources.
// It internally creates a MigrationRunner to handle the actual migration logic.
func NewResourceMigration(
	unifiedMigrator UnifiedMigrator,
	tableLocker MigrationTableLocker,
	tableRenamer MigrationTableRenamer,
	cfg *setting.Cfg,
	def MigrationDefinition,
	validators []Validator,
	opts ...ResourceMigrationOption,
) *ResourceMigration {
	runner := NewMigrationRunner(unifiedMigrator, tableLocker, tableRenamer, cfg, def, validators)
	m := &ResourceMigration{
		runner:      runner,
		resources:   def.GetGroupResources(),
		migrationID: def.ID,
	}
	for _, opt := range opts {
		opt(m, runner)
	}
	return m
}

func (m *ResourceMigration) SkipMigrationLog() bool {
	return false
}

var _ migrator.CodeMigration = (*ResourceMigration)(nil)

// SQL implements migrator.Migration interface. Returns a description string.
func (m *ResourceMigration) SQL(_ migrator.Dialect) string {
	return fmt.Sprintf("unified storage data migration: %s", m.migrationID)
}

// Exec implements migrator.CodeMigration interface. Executes the migration across all organizations.
// It delegates to the internal MigrationRunner for the actual migration logic.
func (m *ResourceMigration) Exec(ctx context.Context, queryer migrator.Queryer, mg *migrator.Migrator) error {
	return m.runner.Run(ctx, queryer, mg, RunOptions{
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
	ID   int64
	Name string
}
