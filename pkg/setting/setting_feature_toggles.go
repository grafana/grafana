package setting

import (
	"fmt"
	"strconv"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/util"
	"gopkg.in/ini.v1"
)

type FeatureToggleState string

const (
	AlphaState   FeatureToggleState = "alpha"   // anything can change without warning
	BetaState    FeatureToggleState = "beta"    // shape looks right, but still evoloving
	StableState  FeatureToggleState = "stable"  // stable and may soon become a build-in feature
	MergedState  FeatureToggleState = "merged"  // feature no longer requires an explicit flag
	RemovedState FeatureToggleState = "removed" // the feature was not merged and no longer has any effect
)

var (
	featureToggleInfo = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "feature_toggles_info",
		Help:      "info metric that exposes what feature toggles are enabled or not",
		Namespace: "grafana",
	}, []string{"name"})
)

type FeatureToggleInfo struct {
	Id          string             `json:"id"`   // the key listed in grafana.ini
	Name        string             `json:"name"` // user
	Description string             `json:"description"`
	AliasIds    []string           `json:"aliasIds,omitempty"` // ids that will also work (support spelling changes and product renames)
	State       FeatureToggleState `json:"state,omitempty"`
	DocsURL     string             `json:"docsURL,omitempty"`

	// Loading state
	Enabled bool `json:"enabled,omitempty"`

	// Special flags
	RequiresDevMode    bool `json:"requiresDevMode,omitempty"`
	RequiresEnterprise bool `json:"requiresEnterprise,omitempty"`
	ModifiesDatabase   bool `json:"modifiesDatabase,omitempty"`
}

type FeatureToggles struct {
	flags    map[string]bool
	info     []FeatureToggleInfo
	messages []string
}

func NewFeatureToggles(flags map[string]bool) FeatureToggles {
	return FeatureToggles{
		flags: flags,
	}
}

func (ft *FeatureToggles) IsEnabled(key string) bool {
	return ft.flags[key]
}

func (cfg *Cfg) readFeatureToggles(iniFile *ini.File) error {
	// Read and populate feature toggles list
	toggles, err := loadFeatureTogglesFromConfiguration(featureFlagOptions{
		cfgSection:   iniFile.Section("feature_toggles"),
		isDev:        cfg.Env == Dev,
		isEnterprise: cfg.IsEnterprise,
		flags:        featureToggleRegistry, // hardcoded in sibling file
	})
	if err != nil {
		return err
	}

	cfg.Features = *toggles

	return nil
}

type featureFlagOptions struct {
	cfgSection   *ini.Section
	isDev        bool
	isEnterprise bool
	flags        []FeatureToggleInfo
}

func loadFeatureTogglesFromConfiguration(opts featureFlagOptions) (*FeatureToggles, error) {
	registry := initFeatureToggleRegistry(opts.flags)
	ff := &FeatureToggles{
		flags: make(map[string]bool, len(registry)),
	}

	// parse the comma separated list in `enable`.
	featuresTogglesStr := valueAsString(opts.cfgSection, "enable", "")
	for _, feature := range util.SplitString(featuresTogglesStr) {
		setToggle(registry, feature, true, ff)
	}

	// read all other settings under [feature_toggles]. If a toggle is
	// present in both the value in `enable` is overridden.
	for _, v := range opts.cfgSection.Keys() {
		if v.Name() == "enable" {
			continue
		}

		b, err := strconv.ParseBool(v.Value())
		if err != nil {
			return ff, err
		}

		setToggle(registry, v.Name(), b, ff)
	}

	// Validate flags based on runtime state
	for _, info := range registry {
		if info.Enabled {
			if info.RequiresDevMode && !opts.isDev {
				info.Enabled = false
				ff.messages = append(ff.messages, "(%s) can only run in development mode", info.Id)
			}

			if info.RequiresEnterprise && !opts.isEnterprise {
				info.Enabled = false
				ff.messages = append(ff.messages, "(%s) requires an enterprise license", info.Id)
			}
		}

		ff.flags[info.Id] = info.Enabled
	}

	// track if feature toggles are enabled or not using an info metric
	for k, v := range ff.flags {
		val := 0.0
		if v {
			val = 1.0
		}
		featureToggleInfo.WithLabelValues(k).Set(val)
	}

	return ff, nil
}

func initFeatureToggleRegistry(opts []FeatureToggleInfo) map[string]*FeatureToggleInfo {
	featureToggles := make(map[string]*FeatureToggleInfo, len(opts)+5)
	for idx, info := range opts {
		featureToggles[info.Id] = &opts[idx]
		if info.AliasIds != nil {
			for _, alias := range info.AliasIds {
				featureToggles[alias] = featureToggles[info.Id]
			}
		}
	}
	return featureToggles
}

func setToggle(registry map[string]*FeatureToggleInfo, key string, val bool, ff *FeatureToggles) {
	info, ok := registry[key]
	if ok {
		info.Enabled = val
	} else {
		ff.flags[key] = val
		ff.messages = append(ff.messages, fmt.Sprintf("unknown feature toggle: %s", key))
	}
}
