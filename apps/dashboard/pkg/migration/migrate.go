package migration

import (
	"fmt"
	"sync"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

// Initialize provides the migrator singleton with required dependencies and builds the map of migrations.
func Initialize(dsInfoProvider schemaversion.DataSourceInfoProvider) {
	migratorInstance.init(dsInfoProvider)
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

func (m *migrator) init(dsInfoProvider schemaversion.DataSourceInfoProvider) {
	initOnce.Do(func() {
		m.migrations = schemaversion.GetMigrations(dsInfoProvider)
		close(m.ready)
	})
}

func (m *migrator) migrate(dash map[string]interface{}, targetVersion int) error {
	if dash == nil {
		return schemaversion.NewMigrationError("dashboard is nil", 0, targetVersion, "")
	}

	// wait for the migrator to be initialized
	<-m.ready

	inputVersion := schemaversion.GetSchemaVersion(dash)
	dash["schemaVersion"] = inputVersion

	// If the schema version is older than the minimum version, with migration support,
	// we don't migrate the dashboard.
	if inputVersion < schemaversion.MIN_VERSION {
		return schemaversion.NewMinimumVersionError(inputVersion)
	}

	for nextVersion := inputVersion + 1; nextVersion <= targetVersion; nextVersion++ {
		if migration, ok := m.migrations[nextVersion]; ok {
			if err := migration(dash); err != nil {
				functionName := fmt.Sprintf("V%d", nextVersion)
				return schemaversion.NewMigrationError("migration failed: "+err.Error(), inputVersion, nextVersion, functionName)
			}
			dash["schemaVersion"] = nextVersion
		}
	}

	if schemaversion.GetSchemaVersion(dash) != targetVersion {
		return schemaversion.NewMigrationError("schema version not migrated to target version", inputVersion, targetVersion, "")
	}

	return nil
}
