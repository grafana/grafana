package setting

import (
	"encoding/json"
	"strconv"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/util"
)

// Deprecated: should use `featuremgmt.FeatureToggles`
func (cfg *Cfg) readFeatureToggles(iniFile *ini.File) error {
	section := iniFile.Section("feature_toggles")
	toggles, err := ReadFeatureTogglesFromInitFile(section)
	if err != nil {
		return err
	}
	// nolint:staticcheck
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

// TypedFeatureFlag represents a flag with its type and value
type TypedFeatureFlag struct {
	Type  string      `json:"type"`
	Value interface{} `json:"value"`
}

// ReadTypedFeatureTogglesFromInitFile reads feature flags with support for different types
func ReadTypedFeatureTogglesFromInitFile(featureTogglesSection *ini.Section) (map[string]TypedFeatureFlag, error) {
	typedFlags := make(map[string]TypedFeatureFlag, 10)

	// parse the comma separated list of values in `enable` key
	featuresTogglesStr := valueAsString(featureTogglesSection, "enable", "")
	for _, feature := range util.SplitString(featuresTogglesStr) {
		typedFlags[feature] = TypedFeatureFlag{
			Type:  "boolean",
			Value: true,
		}
	}

	// read all the other keys under [feature_toggles] section
	for _, v := range featureTogglesSection.Keys() {
		if v.Name() == "enable" {
			continue
		}

		value := v.Value()

		// try to determine the type of flag value
		flagType, parsedValue, err := parseTypedFlagValue(value)
		if err != nil {
			// upon failure, default to boolean for backward compatibility
			if boolVal, boolErr := strconv.ParseBool(value); boolErr == nil {
				typedFlags[v.Name()] = TypedFeatureFlag{
					Type:  "boolean",
					Value: boolVal,
				}
			} else {
				// treat as string if even parsing as boolean fails
				typedFlags[v.Name()] = TypedFeatureFlag{
					Type:  "string",
					Value: value,
				}
			}
		} else {
			typedFlags[v.Name()] = TypedFeatureFlag{
				Type:  flagType,
				Value: parsedValue,
			}
		}
	}
	return typedFlags, nil
}

// parseTypedFlagValue attempts to parse a string value
// into the appropriate type  - bool, float, object
// defaults to string
func parseTypedFlagValue(value string) (string, interface{}, error) {
	if boolVal, err := strconv.ParseBool(value); err == nil {
		return "boolean", boolVal, nil
	}

	// TODO: probably int is needed as well

	if numVal, err := strconv.ParseFloat(value, 64); err == nil {
		return "number", numVal, nil
	}

	var objVal map[string]interface{}
	if err := json.Unmarshal([]byte(value), &objVal); err == nil {
		return "object", objVal, nil
	}

	return "string", value, nil
}
