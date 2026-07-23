package setting

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"

	"gopkg.in/ini.v1"

	"github.com/open-feature/go-sdk/openfeature/memprovider"

	"github.com/grafana/grafana/pkg/util"
)

// DefaultVariantName a placeholder name for config-based Feature Flags
const DefaultVariantName = "default"

// applyFeatureToggleEnvOverrides sets feature toggle values from GF_FEATURE_TOGGLES_<flagName>
// env vars. GF_FEATURE_TOGGLES_ENABLE is handled specially for temporary
// (deprecated) backwards compatibility.
func (cfg *Cfg) applyFeatureToggleEnvOverrides() {
	envPrefix := EnvSectionPrefix("feature_toggles")
	section := cfg.Raw.Section("feature_toggles")

	// Collect prefixes for feature_toggles.* subsections (e.g.
	// feature_toggles.openfeature) so we can skip env vars that belong to
	// them — those are handled by the generic second pass instead.
	var subsectionPrefixes []string
	for _, s := range cfg.Raw.Sections() {
		name := s.Name()
		if strings.HasPrefix(name, "feature_toggles.") {
			subsectionPrefixes = append(subsectionPrefixes, EnvSectionPrefix(name))
		}
	}

	for _, env := range os.Environ() {
		if !strings.HasPrefix(env, envPrefix) {
			continue
		}

		key, value, ok := strings.Cut(env, "=")
		if !ok {
			continue
		}

		if value == "" {
			continue
		}

		// Skip env vars that belong to a feature_toggles.* subsection.
		belongsToSubsection := false
		for _, sp := range subsectionPrefixes {
			if strings.HasPrefix(key, sp) {
				belongsToSubsection = true
				break
			}
		}
		if belongsToSubsection {
			continue
		}

		keyName := key[len(envPrefix):]
		if keyName == "" {
			continue
		}

		// The deprecated "enable" key (comma-separated list) uses an
		// all-uppercase env var name (GF_FEATURE_TOGGLES_ENABLE). Lowercase
		// it so it maps to the "enable" ini key expected by readFeatureToggles.
		if strings.EqualFold(keyName, "enable") {
			keyName = "enable"
		}

		section.Key(keyName).SetValue(value)
		cfg.appliedEnvOverrides = append(cfg.appliedEnvOverrides,
			fmt.Sprintf("%s=%s", key, RedactedValue(key, value)))
	}
}

// applyFeatureToggleCmdOverrides sets feature toggle values from command-line
// properties (cfg:feature_toggles.<name>=<value>). The generic
// applyCommandLineProperties method only overrides keys that already exist in
// the ini file, so feature toggles that aren't in defaults.ini would be
// silently ignored without this.
func (cfg *Cfg) applyFeatureToggleCmdOverrides(file *ini.File) {
	if len(cfg.commandLineProps) == 0 {
		return
	}

	section := file.Section("feature_toggles")

	already := make(map[string]bool, len(cfg.appliedCommandLineProperties))
	for _, p := range cfg.appliedCommandLineProperties {
		k, _, _ := strings.Cut(p, "=")
		already[k] = true
	}

	for propKey, value := range cfg.commandLineProps {
		if !strings.HasPrefix(propKey, "feature_toggles.") {
			continue
		}

		keyName := strings.TrimPrefix(propKey, "feature_toggles.")
		if keyName == "" || strings.Contains(keyName, ".") {
			continue
		}

		section.Key(keyName).SetValue(value)
		if !already[propKey] {
			cfg.appliedCommandLineProperties = append(cfg.appliedCommandLineProperties,
				fmt.Sprintf("%s=%s", propKey, RedactedValue(propKey, value)))
		}
	}
}

// Deprecated: should use `featuremgmt.FeatureToggles`
func (cfg *Cfg) readFeatureToggles(iniFile *ini.File) error {
	cfg.applyFeatureToggleEnvOverrides()
	cfg.applyFeatureToggleCmdOverrides(iniFile)

	section := iniFile.Section("feature_toggles")
	if section.Key("enable").String() != "" {
		if os.Getenv(EnvKey("feature_toggles", "enable")) != "" {
			cfg.Logger.Warn("[Deprecated] The GF_FEATURE_TOGGLES_ENABLE environment variable is deprecated. Use individual GF_FEATURE_TOGGLES_<name>=<value> variables instead.")
		} else {
			cfg.Logger.Warn("[Deprecated] The feature_toggles.enable configuration setting is deprecated. Use individual feature toggle entries (e.g. featureName = <value>) instead.")
		}
	}

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
