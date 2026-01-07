package setting

import (
	"encoding/json"
	"errors"
	"strconv"

	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/util"
)

type FeatureFlagType string

const (
	Structure FeatureFlagType = "structure"
	Integer   FeatureFlagType = "integer"
	Float     FeatureFlagType = "float"
	Boolean   FeatureFlagType = "boolean"
	String    FeatureFlagType = "string"
)

const DefaultVariantName = ""

type FeatureToggle struct {
	Type  FeatureFlagType `json:"type"`
	Name  string          `json:"name"`
	Value any             `json:"value"`
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

		return IsEnabled(toggle)
	}

	return nil
}

func ReadFeatureTogglesFromInitFile(featureTogglesSection *ini.Section) (map[string]memprovider.InMemoryFlag, error) {
	featureToggles := make(map[string]memprovider.InMemoryFlag, 10)

	// parse the comma separated list in `enable`.
	featuresTogglesStr := valueAsString(featureTogglesSection, "enable", "")
	for _, feature := range util.SplitString(featuresTogglesStr) {
		featureToggles[feature] = createFlag(feature, true)
	}

	// read all other settings under [feature_toggles]. If a toggle is
	// present in both the value in `enable` is overridden.
	for _, v := range featureTogglesSection.Keys() {
		if v.Name() == "enable" {
			continue
		}

		b := ParseFlag(v.Name(), v.Value())
		featureToggles[v.Name()] = b
	}
	return featureToggles, nil
}

func ParseFlag(name, value string) memprovider.InMemoryFlag {
	var structure map[string]any

	if integer, err := strconv.Atoi(value); err == nil {
		return createFlag(name, integer)
	}
	if float, err := strconv.ParseFloat(value, 64); err == nil {
		return createFlag(name, float)
	}
	if err := json.Unmarshal([]byte(value), &structure); err == nil {
		return createFlag(name, structure)
	}
	if boolean, err := strconv.ParseBool(value); err == nil {
		return createFlag(name, boolean)
	}

	return createFlag(name, value)
}

func SerializeFlag(flag memprovider.InMemoryFlag) string {
	value, _ := flag.Variants[DefaultVariantName]

	switch castedValue := value.(type) {
	case bool:
		return strconv.FormatBool(castedValue)
	case int64:
		return strconv.FormatInt(castedValue, 10)
	case float64:
		return strconv.FormatFloat(castedValue, 'f', -1, 64)
	case string:
		return castedValue
	default:
		val, _ := json.Marshal(value)
		return string(val)
	}
}

func createFlag(name string, value any) memprovider.InMemoryFlag {
	return memprovider.InMemoryFlag{
		Key:            name,
		DefaultVariant: DefaultVariantName,
		Variants: map[string]any{
			DefaultVariantName: value,
		},
	}
}

func GetDefaultValue(flag memprovider.InMemoryFlag) (any, error) {
	if value, ok := flag.Variants[flag.DefaultVariant]; !ok {
		return nil, errors.New("no default variant found")
	} else {
		return value, nil
	}
}

func IsEnabled(flag memprovider.InMemoryFlag) bool {
	if value, ok := flag.Variants[flag.DefaultVariant]; !ok {
		return false
	} else {
		return value == true
	}
}
