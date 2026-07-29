package externaloverrides

// OverrideStage describes the lifecycle stage of a core-to-external plugin migration.
type OverrideStage int

const (
	// OverrideStageMigrating: migration is opt-in via ini config. The core plugin is suppressed only when
	// as_external = true is set under [plugin.<CorePluginID>] and alias_ids = <CorePluginID> is set under
	// [plugin.<ExternalPluginID>]. Both keys must be present for the override to be active.
	OverrideStageMigrating OverrideStage = iota
	// OverrideStagePermanent: the core plugin has been deleted from the binary. The alias is injected
	// unconditionally for backwards compatibility with existing dashboards.
	OverrideStagePermanent
)

// Override describes a core plugin being replaced by an external one.
type Override struct {
	Stage            OverrideStage
	CorePluginID     string // ID of the core plugin to suppress (e.g. "canvas")
	ExternalPluginID string // published plugin ID (e.g. "grafana-canvas-panel")
}

// Overrides is the registry of all core-to-external plugin migrations.
// Activation is controlled by ini config — set as_external = true under [plugin.<CorePluginID>]
// and alias_ids = <CorePluginID> under [plugin.<ExternalPluginID>] to activate.
// When the core plugin is permanently deleted: change Stage to OverrideStagePermanent.
var Overrides = []Override{
	{
		Stage:            OverrideStageMigrating,
		CorePluginID:     "canvas",
		ExternalPluginID: "grafana-canvas-panel",
	},
}
