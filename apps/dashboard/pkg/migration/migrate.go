package migration

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
)

// Initialize provides the migrator singleton with required dependencies and builds the map of migrations.
func Initialize(dsInfoProvider schemaversion.DataSourceInfoProvider) {
	migratorInstance.init(dsInfoProvider)
}

// ResetForTesting resets the migrator singleton for testing purposes.
func ResetForTesting() {
	migratorInstance = &migrator{
		migrations: map[int]schemaversion.SchemaVersionMigrationFunc{},
		ready:      make(chan struct{}),
	}
	initOnce = sync.Once{}
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

func (m *migrator) init(dsInfoProvider schemaversion.DataSourceInfoProvider) {
	initOnce.Do(func() {
		m.migrations = schemaversion.GetMigrations(dsInfoProvider)
		close(m.ready)
	})
}

func (m *migrator) migrate(ctx context.Context, dash map[string]interface{}, targetVersion int) error {
	if dash == nil {
		return schemaversion.NewMigrationError("dashboard is nil", 0, targetVersion, "")
	}

	// wait for the migrator to be initialized
	<-m.ready

	// 0. Clean up dashboard properties that frontend never includes in save model
	// These properties are added by backend but frontend filters them out
	delete(dash, "__elements")
	delete(dash, "__inputs")
	delete(dash, "__requires")

	// 1. Track which panels had transformations in original input (before any defaults applied)
	// This is needed to match frontend hasOwnProperty behavior
	trackOriginalTransformations(dash)

	// 2. Apply ALL frontend defaults FIRST (DashboardModel + PanelModel defaults)
	// This replicates the behavior of the frontend DashboardModel and PanelModel constructors
	applyFrontendDefaults(dash)

	// 2. Apply panel defaults to ALL panels (both top-level and nested in rows)
	// The frontend creates PanelModel instances for all panels, including those in rows
	if dashboardPanels, ok := dash["panels"].([]interface{}); ok {
		for _, panelInterface := range dashboardPanels {
			if panel, ok := panelInterface.(map[string]interface{}); ok {
				applyPanelDefaults(panel)
			}
		}
	}

	// Apply defaults to panels inside rows (for pre-v16 dashboards)
	// Match frontend upgradeToGridLayout: only panels NOT in collapsed rows get new PanelModel() constructor
	if rows, ok := dash["rows"].([]interface{}); ok {
		showRows := shouldShowRows(rows)

		for _, rowInterface := range rows {
			row, ok := rowInterface.(map[string]interface{})
			if !ok {
				continue
			}

			applyRowPanelDefaults(row, showRows)
		}
	}

	// 3. Ensure panel IDs are unique for ALL panels (including nested ones)
	// This matches the frontend ensurePanelsHaveUniqueIds() behavior
	ensurePanelsHaveUniqueIds(dash)

	// TODO: Probably we can check if we can migrate at the beginning of the function
	// 4. Ensure schema version is set and if not default to 0
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

	// 6. Clean up the dashboard to match frontend getSaveModel behavior
	// This removes properties that shouldn't be persisted and filters out default values
	cleanupDashboardForSave(dash)

	if schemaversion.GetSchemaVersion(dash) != targetVersion {
		return schemaversion.NewMigrationError("schema version not migrated to target version", inputVersion, targetVersion, "")
	}

	return nil
}

// shouldShowRows determines if row panels will be created (showRows logic)
func shouldShowRows(rows []interface{}) bool {
	for _, rowInterface := range rows {
		row, ok := rowInterface.(map[string]interface{})
		if !ok {
			continue
		}

		collapse := schemaversion.GetBoolValue(row, "collapse")
		showTitle := schemaversion.GetBoolValue(row, "showTitle")
		repeat := schemaversion.GetStringValue(row, "repeat")

		if collapse || showTitle || repeat != "" {
			return true
		}
	}
	return false
}

// applyRowPanelDefaults applies panel defaults to panels within a row based on frontend logic
func applyRowPanelDefaults(row map[string]interface{}, showRows bool) {
	rowPanels, ok := row["panels"].([]interface{})
	if !ok {
		return
	}

	collapse := schemaversion.GetBoolValue(row, "collapse")

	// Frontend: if (rowPanelModel && rowPanel.collapsed) { push(panel) } else { push(new PanelModel(panel)) }
	// Only non-collapsed panels get PanelModel defaults (refId: "A", overrides: [], etc.)
	applyDefaults := !showRows || !collapse

	if !applyDefaults {
		return
	}

	for _, panelInterface := range rowPanels {
		panel, ok := panelInterface.(map[string]interface{})
		if !ok {
			continue
		}
		applyPanelDefaults(panel)
	}
}
