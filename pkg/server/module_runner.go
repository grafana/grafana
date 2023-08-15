package server

import (
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// ModuleRunner is a simplified version of Runner that is used in the grafana
// server target command. It pulls in a minimal set of dependencies.
type ModuleRunner struct {
	Cfg              *setting.Cfg
	SettingsProvider setting.Provider
	Features         featuremgmt.FeatureToggles
}

func NewModuleRunner(cfg *setting.Cfg, settingsProvider setting.Provider,
	features featuremgmt.FeatureToggles,
) ModuleRunner {
	return ModuleRunner{
		Cfg:              cfg,
		SettingsProvider: settingsProvider,
		Features:         features,
	}
}
