package migration

import (
	"errors"
	"fmt"
	"sync"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

var logger = logging.DefaultLogger.With("logger", "dashboard.migration")

// Initialize provides the migrator singleton with required dependencies and builds the map of migrations.
func Initialize(dsInfoProvider schemaversion.DataSourceInfoProvider, panelProvider schemaversion.PanelPluginInfoProvider) {
	migratorInstance.init(dsInfoProvider, panelProvider)
}

// Migrate migrates the given dashboard to the target version.
// This will block until the migrator is initialized.
func Migrate(dash map[string]interface{}, targetVersion int) error {
	return migratorInstance.migrate(dash, targetVersion)
}

var (
	migratorInstance = &migrator{
		migrations: map[int]schemaversion.SchemaVersionMigrationFunc{},
		ready:      make(chan struct{}),
	}
	initOnce sync.Once
)

type migrator struct {
	ready      chan struct{}
	migrations map[int]schemaversion.SchemaVersionMigrationFunc
}

func (m *migrator) init(dsInfoProvider schemaversion.DataSourceInfoProvider, panelProvider schemaversion.PanelPluginInfoProvider) {
	initOnce.Do(func() {
		m.migrations = schemaversion.GetMigrations(dsInfoProvider, panelProvider)
		close(m.ready)
	})
}

func (m *migrator) migrate(dash map[string]interface{}, targetVersion int) error {
	if dash == nil {
		return schemaversion.NewMigrationError("dashboard is nil", 0, targetVersion)
	}

	// wait for the migrator to be initialized
	<-m.ready

	inputVersion := schemaversion.GetSchemaVersion(dash)
	dash["schemaVersion"] = inputVersion

	// If the schema version is older than the minimum version, with migration support,
	// we don't migrate the dashboard.
	if inputVersion < schemaversion.MIN_VERSION {
		err := schemaversion.NewMinimumVersionError(inputVersion)
		m.reportMigrationMetrics(inputVersion, targetVersion, err)
		return err
	}

	for nextVersion := inputVersion + 1; nextVersion <= targetVersion; nextVersion++ {
		if migration, ok := m.migrations[nextVersion]; ok {
			if err := migration(dash); err != nil {
				migrationErr := schemaversion.NewMigrationError("migration failed: "+err.Error(), inputVersion, nextVersion)
				m.reportMigrationMetrics(inputVersion, targetVersion, migrationErr)
				return migrationErr
			}
			dash["schemaVersion"] = nextVersion
		}
	}

	if schemaversion.GetSchemaVersion(dash) != targetVersion {
		err := schemaversion.NewMigrationError("schema version not migrated to target version", inputVersion, targetVersion)
		m.reportMigrationMetrics(inputVersion, targetVersion, err)
		return err
	}

	// Report successful migration
	m.reportMigrationMetrics(inputVersion, targetVersion, nil)
	return nil
}

// reportMigrationMetrics reports metrics and logs for schema migration attempts
func (m *migrator) reportMigrationMetrics(sourceSchemaVersion, targetSchemaVersion int, err error) {
	sourceVersionStr := fmt.Sprintf("%d", sourceSchemaVersion)
	targetVersionStr := fmt.Sprintf("%d", targetSchemaVersion)

	if err != nil {
		// Classify error type for metrics
		errorType := "migration_error"
		var migrationErr *schemaversion.MigrationError
		var minVersionErr *schemaversion.MinimumVersionError
		if errors.As(err, &migrationErr) {
			errorType = "schema_version_migration_error"
		} else if errors.As(err, &minVersionErr) {
			errorType = "schema_minimum_version_error"
		}

		// Record failure metrics
		MDashboardSchemaMigrationFailureTotal.WithLabelValues(
			sourceVersionStr,
			targetVersionStr,
			errorType,
		).Inc()

		// Log failure
		logger.Error("Dashboard schema migration failed",
			"sourceSchemaVersion", sourceSchemaVersion,
			"targetSchemaVersion", targetSchemaVersion,
			"errorType", errorType,
			"error", err)
	} else {
		// Record success metrics
		MDashboardSchemaMigrationSuccessTotal.WithLabelValues(
			sourceVersionStr,
			targetVersionStr,
		).Inc()

		// Log success (debug level to avoid spam)
		logger.Debug("Dashboard schema migration succeeded",
			"sourceSchemaVersion", sourceSchemaVersion,
			"targetSchemaVersion", targetSchemaVersion)
	}
}
