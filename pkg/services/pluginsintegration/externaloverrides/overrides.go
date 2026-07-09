package externaloverrides

// FeatureFlagName is the name of a feature toggle. Using a named type instead of a plain string
// prevents accidental assignment of arbitrary strings and makes the intent explicit at call sites.
// We cannot import featuremgmt here due to an import cycle via setting_plugins.go.
type FeatureFlagName string

// OverrideStage describes the lifecycle stage of a core-to-external plugin migration.
type OverrideStage int

const (
	// OverrideStageFlagged: migration gated by a feature flag; core suppressed when on, external blocked when off.
	OverrideStageFlagged OverrideStage = iota
	// OverrideStagePermanent: flag retired, core deleted; alias injected unconditionally for dashboard backwards compat.
	OverrideStagePermanent
)

// Override describes a core plugin being replaced by an external one.
type Override struct {
	Stage            OverrideStage
	FeatureFlag      FeatureFlagName // only consulted when Stage == OverrideStageFlagged
	CorePluginID     string          // ID of the core plugin to suppress (e.g. "canvas")
	ExternalPluginID string          // conformant published plugin ID (e.g. "grafana-canvas-panel")
}

// Overrides is the list of all core-to-external plugin migrations.
// To add a plugin: append an entry with OverrideStageFlagged.
// When the flag is retired and the core plugin deleted: change to OverrideStagePermanent and omit FeatureFlag (leave as "").
var Overrides = []Override{
	{
		Stage:            OverrideStageFlagged,
		FeatureFlag:      "canvasExternalPlugin",
		CorePluginID:     "canvas",
		ExternalPluginID: "grafana-canvas-panel",
	},
}
