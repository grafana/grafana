package setting

import (
	"github.com/grafana/grafana/pkg/util"
)

type FeatureMgmtSettings struct {
	HiddenToggles      map[string]struct{}
	ReadOnlyToggles    map[string]struct{}
	AllowEditing       bool
	UpdateWebhook      string
	UpdateWebhookToken string
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
	cfg.FeatureManagement.AllowEditing = cfg.SectionWithEnvOverrides("feature_management").Key("allow_editing").MustBool(false)
	cfg.FeatureManagement.UpdateWebhook = cfg.SectionWithEnvOverrides("feature_management").Key("update_webhook").MustString("")
	cfg.FeatureManagement.UpdateWebhookToken = cfg.SectionWithEnvOverrides("feature_management").Key("update_webhook_token").MustString("")
}
