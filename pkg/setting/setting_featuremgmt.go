package setting

import (
	"github.com/grafana/grafana/pkg/util"
)

type FeatureMgmtSettings struct {
	HiddenToggles   map[string]struct{}
	ReadOnlyToggles map[string]struct{}
}

func (cfg *Cfg) readFeatureManagementConfig() {
	section := cfg.Raw.Section("feature_management")

	hiddenToggles := make(map[string]struct{})
	readOnlyToggles := make(map[string]struct{})

	// parse the comma separated list in `hidden_toggles`.
	hiddenTogglesStr := valueAsString(section, "hidden_toggles", "")
	for _, feature := range util.SplitString(hiddenTogglesStr) {
		hiddenToggles[feature] = struct{}{}
	}

	// parse the comma separated list in `read_only_toggles`.
	readOnlyTogglesStr := valueAsString(section, "read_only_toggles", "")
	for _, feature := range util.SplitString(readOnlyTogglesStr) {
		readOnlyToggles[feature] = struct{}{}
	}

	cfg.FeatureManagement.HiddenToggles = hiddenToggles
	cfg.FeatureManagement.ReadOnlyToggles = readOnlyToggles
}
