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

		value, ok := toggle.Variants[toggle.DefaultVariant].(bool)
		return value && ok
	}
	return nil
}

func ReadFeatureTogglesFromInitFile(featureTogglesSection *ini.Section) (map[string]memprovider.InMemoryFlag, error) {
	featureToggles := make(map[string]memprovider.InMemoryFlag, 10)

	// parse the comma separated list in `enable`.
	featuresTogglesStr := valueAsString(featureTogglesSection, "enable", "")
	for _, feature := range util.SplitString(featuresTogglesStr) {
		featureToggles[feature] = memprovider.InMemoryFlag{Key: feature, DefaultVariant: DefaultVariantName, Variants: map[string]any{DefaultVariantName: true}}
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

		featureToggles[v.Name()] = b
	}
	return featureToggles, nil
}

func ParseFlag(name, value string) (memprovider.InMemoryFlag, error) {
	var structure map[string]any

	if integer, err := strconv.Atoi(value); err == nil {
		return NewInMemoryFlag(name, integer), nil
	}
	if float, err := strconv.ParseFloat(value, 64); err == nil {
		return NewInMemoryFlag(name, float), nil
	}
	if err := json.Unmarshal([]byte(value), &structure); err == nil {
		return NewInMemoryFlag(name, structure), nil
	}
	if boolean, err := strconv.ParseBool(value); err == nil {
		return NewInMemoryFlag(name, boolean), nil
	}

	return NewInMemoryFlag(name, value), nil
}

func NewInMemoryFlag(name string, value any) memprovider.InMemoryFlag {
	return memprovider.InMemoryFlag{Key: name, DefaultVariant: DefaultVariantName, Variants: map[string]any{DefaultVariantName: value}}
}

func AsStringMap(m map[string]memprovider.InMemoryFlag) map[string]string {
	var res = map[string]string{}
	for k, v := range m {
		res[k] = serializeFlagValue(v)
	}
	return res
}

func serializeFlagValue(flag memprovider.InMemoryFlag) string {
	value, _ := flag.Variants[flag.DefaultVariant]

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
