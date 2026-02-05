package setting

import (
	"encoding/json"
	"math"
	"strconv"

	"gopkg.in/ini.v1"

	"github.com/open-feature/go-sdk/openfeature/memprovider"

	"github.com/grafana/grafana/pkg/util"
)

// DefaultVariantName a placeholder name for config-based Feature Flags
const DefaultVariantName = "default"

// Deprecated: should use `featuremgmt.FeatureToggles`
func (cfg *Cfg) readFeatureToggles(iniFile *ini.File) error {
	section := iniFile.Section("feature_toggles")
	typedFlags, err := ReadFeatureTogglesFromInitFile(section)
	if err != nil {
		return err
	}
	// TODO IsFeatureToggleEnabled has been deprecated for 2 years now, we should remove this function completely
	// nolint:staticcheck
	cfg.IsFeatureToggleEnabled = func(key string) bool {
		typedFlag, ok := typedFlags[key]
		if !ok {
			return false
		}

		value, ok := typedFlag.Variants[typedFlag.DefaultVariant].(bool)
		return value && ok
	}
	return nil
}

func ReadFeatureTogglesFromInitFile(featureTogglesSection *ini.Section) (map[string]TypedFlag, error) {
	typedFlags := make(map[string]TypedFlag, 10)

	// parse the comma separated list in `enable`.
	featuresTogglesStr := valueAsString(featureTogglesSection, "enable", "")
	for _, feature := range util.SplitString(featuresTogglesStr) {
		typedFlags[feature] = TypedFlag{
			InMemoryFlag: memprovider.InMemoryFlag{Key: feature, DefaultVariant: DefaultVariantName, Variants: map[string]any{DefaultVariantName: true}},
			Type:         FlagTypeBoolean,
		}
	}

	// read all other settings under [feature_toggles]. If a toggle is
	// present in both the value in `enable` is overridden.
	for _, v := range featureTogglesSection.Keys() {
		if v.Name() == "enable" {
			continue
		}

		flag, flagType, err := ParseFlagWithType(v.Name(), v.Value())
		if err != nil {
			return typedFlags, err
		}

		typedFlags[v.Name()] = TypedFlag{
			InMemoryFlag: flag,
			Type:         flagType,
		}
	}
	return typedFlags, nil
}

// FlagType represents the data type of a feature flag
type FlagType int

const (
	FlagTypeBoolean FlagType = iota
	FlagTypeInteger
	FlagTypeFloat
	FlagTypeString
	FlagTypeObject
)

// TypedFlag embeds InMemoryFlag and adds type information
type TypedFlag struct {
	memprovider.InMemoryFlag
	Type FlagType
}

// ParseFlagWithType parses a flag value and returns both the InMemoryFlag and its type
func ParseFlagWithType(name, value string) (memprovider.InMemoryFlag, FlagType, error) {
	var structure map[string]any

	if integer, err := strconv.Atoi(value); err == nil {
		return NewInMemoryFlag(name, integer), FlagTypeInteger, nil
	}
	if float, err := strconv.ParseFloat(value, 64); err == nil {
		return NewInMemoryFlag(name, float), FlagTypeFloat, nil
	}
	if err := json.Unmarshal([]byte(value), &structure); err == nil {
		return NewInMemoryFlag(name, structure), FlagTypeObject, nil
	}
	if boolean, err := strconv.ParseBool(value); err == nil {
		return NewInMemoryFlag(name, boolean), FlagTypeBoolean, nil
	}

	return NewInMemoryFlag(name, value), FlagTypeString, nil
}

func NewInMemoryFlag(name string, value any) memprovider.InMemoryFlag {
	return memprovider.InMemoryFlag{Key: name, DefaultVariant: DefaultVariantName, Variants: map[string]any{DefaultVariantName: value}}
}

func AsStringMap(m map[string]TypedFlag) map[string]string {
	var res = map[string]string{}
	for k, v := range m {
		res[k] = serializeFlagValue(v.InMemoryFlag)
	}
	return res
}

func serializeFlagValue(flag memprovider.InMemoryFlag) string {
	value := flag.Variants[flag.DefaultVariant]

	switch castedValue := value.(type) {
	case bool:
		return strconv.FormatBool(castedValue)
	case int64:
		return strconv.FormatInt(castedValue, 10)
	case float64:
		// handle cases with a single or no zeros after the decimal point
		if math.Trunc(castedValue) == castedValue {
			return strconv.FormatFloat(castedValue, 'f', 1, 64)
		}

		return strconv.FormatFloat(castedValue, 'g', -1, 64)
	case string:
		return castedValue
	default:
		val, _ := json.Marshal(value)
		return string(val)
	}
}
