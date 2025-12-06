package setting

import (
	"gopkg.in/ini.v1"
)

// FeatureToggles holds lightweight feature flags that can be set via grafana.ini
type FeatureToggles struct {
	// DefaultSidebarDocked determines the default state of the left navigation when no per-browser
	// preference exists in localStorage (grafana.navigation.docked).
	DefaultSidebarDocked bool `json:"default_sidebar_docked"`
}

var FeatureToggleConfig = &FeatureToggles{DefaultSidebarDocked: true}

// loadFeatureToggles reads [feature_toggles] section from the provided INI file.
// This is a minimal helper; integrate it into your existing settings loader.
func loadFeatureToggles(cfg *ini.File) {
	sec := cfg.Section("feature_toggles")
	FeatureToggleConfig.DefaultSidebarDocked = sec.Key("default_sidebar_docked").MustBool(true)
}
