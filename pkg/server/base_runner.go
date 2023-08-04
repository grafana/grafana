// i  don't know what this does
package server

import (
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type BaseRunner struct {
	Cfg              *setting.Cfg
	SettingsProvider setting.Provider
	Features         featuremgmt.FeatureToggles
}

func NewBaseRunner(cfg *setting.Cfg, settingsProvider setting.Provider, features featuremgmt.FeatureToggles,
) BaseRunner {
	return BaseRunner{
		Cfg:              cfg,
		SettingsProvider: settingsProvider,
		Features:         features,
	}
}
