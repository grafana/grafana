package migration

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

// Initialize provides the migrator singleton with required dependencies and builds the map of migrations.
func Initialize(dsInfoProvider schemaversion.DataSourceInfoProvider, panelProvider schemaversion.PanelPluginInfoProvider) {
	migratorInstance.init(dsInfoProvider, panelProvider)
}

// Migrate migrates the given dashboard to the target version.
// This will block until the migrator is initialized.
func Migrate(ctx context.Context, dash map[string]interface{}, targetVersion int) error {
	return migratorInstance.migrate(ctx, dash, targetVersion)
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

func (m *migrator) migrate(ctx context.Context, dash map[string]interface{}, targetVersion int) error {
	if dash == nil {
		return schemaversion.NewMigrationError("dashboard is nil", 0, targetVersion, "")
	}

	// wait for the migrator to be initialized
	<-m.ready

	// 1. Apply ALL frontend defaults FIRST (DashboardModel + PanelModel defaults)
	// This replicates the behavior of the frontend DashboardModel and PanelModel constructors
	applyFrontendDefaults(dash)

	// 2. Apply panel defaults to each panel (including nested panels)
	// This matches the frontend behavior where PanelModel constructor is called on ALL panels
	panels := getPanels(dash)
	for _, panel := range panels {
		applyPanelDefaults(panel)
	}

	// 3. Ensure panel IDs are unique for ALL panels (including nested ones)
	// This matches the frontend ensurePanelsHaveUniqueIds() behavior
	ensurePanelsHaveUniqueIds(dash)

	// 4. Clean up the dashboard to match frontend getSaveModel behavior
	// This removes properties that shouldn't be persisted and filters out default values
	cleanupDashboardForSave(dash)

	inputVersion := schemaversion.GetSchemaVersion(dash)
	dash["schemaVersion"] = inputVersion

	// If the schema version is older than the minimum version, with migration support,
	// we don't migrate the dashboard.
	if inputVersion < schemaversion.MIN_VERSION {
		return schemaversion.NewMinimumVersionError(inputVersion)
	}

	// 5. Run existing migration pipeline UNCHANGED
	// (All the existing v28, v29, etc. migrators run exactly as before)
	for nextVersion := inputVersion + 1; nextVersion <= targetVersion; nextVersion++ {
		if migration, ok := m.migrations[nextVersion]; ok {
			if err := migration(ctx, dash); err != nil {
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
