package setting

import (
	"strconv"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/util"
)

// @deprecated -- should use `featuremgmt.FeatureToggles`
func (cfg *Cfg) readFeatureToggles(iniFile *ini.File) error {
	section := iniFile.Section("feature_toggles")
	toggles, err := ReadFeatureTogglesFromInitFile(section)
	if err != nil {
		return err
	}
	cfg.IsFeatureToggleEnabled = func(key string) bool { return toggles[key] }
	return nil
}

func ReadFeatureTogglesFromInitFile(featureTogglesSection *ini.Section) (map[string]bool, error) {
	featureToggles := make(map[string]bool, 10)

	// parse the comma separated list in `enable`.
	featuresTogglesStr := valueAsString(featureTogglesSection, "enable", "")
	for _, feature := range util.SplitString(featuresTogglesStr) {
		featureToggles[feature] = true
	}

	// read all other settings under [feature_toggles]. If a toggle is
	// present in both the value in `enable` is overridden.
	for _, v := range featureTogglesSection.Keys() {
		if v.Name() == "enable" {
			continue
		}

		b, err := strconv.ParseBool(v.Value())
		if err != nil {
			return featureToggles, err
		}

		featureToggles[v.Name()] = b
	}
	return featureToggles, nil
}
