package setting

import (
	"encoding/json"
	"fmt"
	"strconv"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/util"
)

type FeatureToggleType string

const Structure FeatureToggleType = "structure"
const Integer FeatureToggleType = "integer"
const Float FeatureToggleType = "float"
const Boolean FeatureToggleType = "boolean"
const String FeatureToggleType = "string"

type FeatureToggle struct {
	Type  FeatureToggleType `json:"type"`
	Name  string            `json:"name"`
	Value any               `json:"value"`
}

// Deprecated: should use `featuremgmt.FeatureToggles`
func (cfg *Cfg) readFeatureToggles(iniFile *ini.File) error {
	section := iniFile.Section("feature_toggles")
	toggles, err := ReadFeatureTogglesFromInitFile(section)
	if err != nil {
		return err
	}
	// TODO IsFeatureToggleEnabled has been deprecated for 2 years now, we should remove this function completely
	// nolint:staticcheck
	cfg.IsFeatureToggleEnabled = func(key string) bool {

		toggle, ok := toggles[key]
		if !ok {
			return false
		}

		return toggle.Type == Boolean && toggle.Value == true
	}
	return nil
}

func ReadFeatureTogglesFromInitFile(featureTogglesSection *ini.Section) (map[string]FeatureToggle, error) {
	featureToggles := make(map[string]FeatureToggle, 10)

	// parse the comma separated list in `enable`.
	featuresTogglesStr := valueAsString(featureTogglesSection, "enable", "")
	for _, feature := range util.SplitString(featuresTogglesStr) {
		featureToggles[feature] = FeatureToggle{
			Type:  Boolean,
			Name:  feature,
			Value: true,
		}
	}

	// read all other settings under [feature_toggles]. If a toggle is
	// present in both the value in `enable` is overridden.
	for _, v := range featureTogglesSection.Keys() {
		if v.Name() == "enable" {
			continue
		}

		b, err := ParseFlag(v.Name(), v.Value())
		if err != nil {
			return featureToggles, err
		}

		flag, exists := featureToggles[v.Name()]
		if exists && flag.Type != b.Type {
			return nil, fmt.Errorf("type mismatch during flag declaration '%s': %s, %s", v.Name(), flag.Type, b.Type)
		}

		featureToggles[v.Name()] = b
	}
	return featureToggles, nil
}

func ParseFlag(name, value string) (FeatureToggle, error) {
	var structure any

	if boolean, err := strconv.ParseBool(value); err == nil {
		return FeatureToggle{Type: Boolean, Name: name, Value: boolean}, nil
	}
	if integer, err := strconv.Atoi(value); err == nil {
		return FeatureToggle{Type: Integer, Name: name, Value: integer}, nil
	}
	if float, err := strconv.ParseFloat(value, 64); err == nil {
		return FeatureToggle{Type: Float, Name: name, Value: float}, nil
	}
	if err := json.Unmarshal([]byte(value), &structure); err == nil {
		return FeatureToggle{Type: Structure, Name: name, Value: structure}, nil
	}
	return FeatureToggle{Type: String, Name: name, Value: value}, nil
}
