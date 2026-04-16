package migrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
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
	migrationID     string
	resources       []schema.GroupResource
	validators      []Validator
}

// NewMigrationRunner creates a new migration runner.
func NewMigrationRunner(unifiedMigrator UnifiedMigrator, migrationID string, resources []schema.GroupResource, validators []Validator, opts ...MigrationRunnerOption) *MigrationRunner {
	r := &MigrationRunner{
		unifiedMigrator: unifiedMigrator,
		log:             log.New("storage.unified.migration_runner." + migrationID),
		migrationID:     migrationID,
		resources:       resources,
		validators:      validators,
	}
	for _, opt := range opts {
		opt(r)
	}
	return r
}

// ConfigResources returns the resource identifiers in the format used by setting.UnifiedStorage config.
// The format is "resource.group" (e.g., "dashboards.dashboard.grafana.app").
func (r *MigrationRunner) configResources() []string {
	result := make([]string, len(r.resources))
	for i, ri := range r.resources {
		result[i] = ri.Resource + "." + ri.Group
	}
	return result
}

// RunOptions configures a migration run.
type RunOptions struct {
	DriverName       string
	UsingDistributor bool
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

	// Skip migration if all resources are already on unified storage
	// this handles earlier instances that were writing directly to unistore and never
	// migrated through the legacy path. without this check, the migration would wipe
	// unistore and repopulate from sql, resulting in data loss
	alreadyMigrated, err := r.isAlreadyOnUnifiedStorage(sess)
	if err != nil {
		r.log.Error("failed to check dualwrite state, aborting migration", "error", err)
		return fmt.Errorf("failed to check dualwrite state: %w", err)
	}
	if alreadyMigrated {
		r.log.Debug("skipping migration: resources already on unified storage per dualwrite state",
			"resources", r.configResources())
		return nil
	}

	if opts.DriverName == migrator.SQLite {
		// reuse transaction in SQLite to avoid "database is locked" errors
		tx, err := sess.Tx()
		if err != nil {
			r.log.Error("Failed to get transaction from session", "error", err)
			return fmt.Errorf("failed to get transaction: %w", err)
		}
		// Increase page cache to prevent cache spill during bulk inserts.
		// When the cache spills, SQLite needs an EXCLUSIVE lock which deadlocks with the
		// SHARED lock held by the legacy database rows cursor on another connection.
		// Configurable via [unified_storage] migration_cache_size_kb (default: 1GB).
		cacheKB := 1000000
		if r.cfg.MigrationCacheSizeKB > 0 {
			cacheKB = r.cfg.MigrationCacheSizeKB
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf("PRAGMA cache_size = -%d", cacheKB)); err != nil {
			r.log.Warn("Failed to set SQLite cache_size for migration", "error", err)
		}
		ctx = resource.ContextWithTransaction(ctx, tx.Tx)
		r.log.Info("Stored migrator transaction in context for bulk operations (SQLite compatibility)")
	}

	if err := r.migrateAllOrgs(ctx, sess, orgs, opts); err != nil {
		if opts.DriverName != migrator.SQLite {
			return err
		}
		r.log.Warn("SQLite migration failed, retrying with parquet buffer", "error", err)
		ctx = resource.ContextWithParquetBuffer(ctx)
		if err := r.migrateAllOrgs(ctx, sess, orgs, opts); err != nil {
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

func (r *MigrationRunner) migrateAllOrgs(ctx context.Context, sess *xorm.Session, orgs []orgInfo, opts RunOptions) error {
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
	return nil
}

// MigrateOrg handles migration for a single organization.
func (r *MigrationRunner) MigrateOrg(ctx context.Context, sess *xorm.Session, info types.NamespaceInfo, opts RunOptions) error {
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

// dualwriteKVNamespace was used in older versions of grafana to keep track of dual writer state.
// it is no longer used, other than for backwards compatibility
const dualwriteKVNamespace = "unified.dualwrite"

// FoldersDashboardsMigrationID is the definition ID of the folders/dashboards migration.
// It is the only migration whose legacy dualwrite state we need to verify.
const FoldersDashboardsMigrationID = "folders-dashboards"

// dualwriteFileName is the name of the file used by G12.0.0 to persist dualwrite state
// in the data directory. It contains a JSON-encoded map of resource keys
// (e.g. "dashboards.dashboard.grafana.app") to dualwriteStorageStatus.
const dualwriteFileName = "dualwrite.json"

// dualwriteStorageStatus holds info to determine whether a resource was already migrated to unified storage
type dualwriteStorageStatus struct {
	ReadUnified  bool  `json:"read_unified"`
	WriteUnified bool  `json:"write_unified"`
	WriteLegacy  bool  `json:"write_legacy"`
	Migrated     int64 `json:"migrated"`
}

// migratedToUnified reports whether the status indicates a completed migration to unified storage.
func (s dualwriteStorageStatus) migratedToUnified() bool {
	return s.ReadUnified && s.WriteUnified && !s.WriteLegacy && s.Migrated > 0
}

// isAlreadyOnUnifiedStorage checks persisted dualwrite state used by prior versions of Grafana.
// Returns true when all resources in the definition were already migrated to unified storage
// (read_unified=true, write_unified=true, write_legacy=false, and migrated>0).
// This is to prevent data loss, as otherwise unified storage will be wiped and repopulated
// from sql, destroying resources that only exist in unified storage.
//
// Two historical locations are checked:
//   - kv_store table with namespace "unified.dualwrite" (12.1.0+)
//   - <data_path>/dualwrite.json file containing a map[string]StorageStatus (12.0.0)
//
// This legacy path was only ever exposed for folders/dashboards, so this check is skipped
// for every other migration definition.
func (r *MigrationRunner) isAlreadyOnUnifiedStorage(sess *xorm.Session) (bool, error) {
	if r.migrationID != FoldersDashboardsMigrationID {
		return false, nil
	}

	configResources := r.configResources()
	if len(configResources) == 0 {
		return false, nil
	}

	fileStatuses, err := r.readDualwriteFile()
	if err != nil {
		return false, fmt.Errorf("failed to read dualwrite state file: %w", err)
	}

	for _, key := range configResources {
		if status, ok := fileStatuses[key]; ok {
			if !status.migratedToUnified() {
				return false, nil
			}
			continue
		}

		status, found, err := r.readDualwriteKVState(sess, key)
		if err != nil {
			return false, err
		}
		if !found || !status.migratedToUnified() {
			return false, nil
		}
	}

	return true, nil
}

// readDualwriteKVState loads dualwrite state for the given resource key from kv_store.
func (r *MigrationRunner) readDualwriteKVState(sess *xorm.Session, key string) (dualwriteStorageStatus, bool, error) {
	orgID := int64(0)
	ns := dualwriteKVNamespace
	k := key
	item := kvstore.Item{
		OrgId:     &orgID,
		Namespace: &ns,
		Key:       &k,
	}
	found, err := sess.Get(&item)
	if err != nil {
		return dualwriteStorageStatus{}, false, fmt.Errorf("failed to query dualwrite state for %s: %w", key, err)
	}
	if !found {
		return dualwriteStorageStatus{}, false, nil
	}

	var status dualwriteStorageStatus
	if err := json.Unmarshal([]byte(item.Value), &status); err != nil {
		return dualwriteStorageStatus{}, false, fmt.Errorf("failed to parse dualwrite state for %s: %w", key, err)
	}
	return status, true, nil
}

// readDualwriteFile loads dualwrite state written by G12.0.0 from <data_path>/dualwrite.json.
// Returns an empty map (not an error) when the file or data path is not present.
func (r *MigrationRunner) readDualwriteFile() (map[string]dualwriteStorageStatus, error) {
	if r.cfg == nil || r.cfg.DataPath == "" {
		return nil, nil
	}

	path := filepath.Clean(filepath.Join(r.cfg.DataPath, dualwriteFileName))
	data, err := os.ReadFile(path) // #nosec G304 -- path is derived from trusted config
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, err
	}

	var statuses map[string]dualwriteStorageStatus
	if err := json.Unmarshal(data, &statuses); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", path, err)
	}
	return statuses, nil
}
