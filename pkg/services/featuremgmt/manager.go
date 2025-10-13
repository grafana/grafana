package featuremgmt

import (
	"context"
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ FeatureToggles = (*FeatureManager)(nil)
)

type FeatureManager struct {
	isDevMod        bool
	restartRequired bool

	Settings setting.FeatureMgmtSettings

	flags    map[string]*FeatureFlag
	enabled  map[string]bool   // only the "on" values
	startup  map[string]bool   // the explicit values registered at startup
	warnings map[string]string // potential warnings about the flag
	log      log.Logger
}

// This will merge the flags with the current configuration
func (fm *FeatureManager) registerFlags(flags ...FeatureFlag) {
	for _, add := range flags {
		if add.Name == "" {
			continue // skip it with warning?
		}
		flag, ok := fm.flags[add.Name]
		if !ok {
			f := add // make a copy
			fm.flags[add.Name] = &f
			continue
		}

		// Selectively update properties
		if add.Description != "" {
			flag.Description = add.Description
		}
		if add.Expression != "" {
			flag.Expression = add.Expression
		}

		// The most recently defined state
		if add.Stage != FeatureStageUnknown {
			flag.Stage = add.Stage
		}

		// Only gets more restrictive
		if add.RequiresDevMode {
			flag.RequiresDevMode = true
		}

		if add.RequiresRestart {
			flag.RequiresRestart = true
		}
	}

	// This will evaluate all flags
	fm.update()
}

// meetsRequirements checks if grafana is able to run the given feature due to dev mode or licensing requirements
func (fm *FeatureManager) meetsRequirements(ff *FeatureFlag) (bool, string) {
	if ff.RequiresDevMode && !fm.isDevMod {
		return false, "requires dev mode"
	}

	return true, ""
}

// Update
func (fm *FeatureManager) update() {
	enabled := make(map[string]bool)
	for _, flag := range fm.flags {
		// if grafana cannot run the feature, omit metrics around it
		ok, reason := fm.meetsRequirements(flag)
		if !ok {
			fm.warnings[flag.Name] = reason
			continue
		}

		// Update the registry
		track := 0.0

		startup, ok := fm.startup[flag.Name]
		if startup || (!ok && flag.Expression == "true") {
			track = 1
			enabled[flag.Name] = true
		}

		// Register value with prometheus metric
		featureToggleInfo.WithLabelValues(flag.Name).Set(track)
	}
	fm.enabled = enabled
}

// IsEnabled checks if a feature is enabled
func (fm *FeatureManager) IsEnabled(ctx context.Context, flag string) bool {
	return fm.enabled[flag]
}

// IsEnabledGlobally checks if a feature is for all tenants
func (fm *FeatureManager) IsEnabledGlobally(flag string) bool {
	return fm.enabled[flag]
}

// GetEnabled returns a map containing only the features that are enabled
func (fm *FeatureManager) GetEnabled(ctx context.Context) map[string]bool {
	enabled := make(map[string]bool, len(fm.enabled))
	for key, val := range fm.enabled {
		if val {
			enabled[key] = true
		}
	}
	return enabled
}

// GetFlags returns all flag definitions
func (fm *FeatureManager) GetFlags() []FeatureFlag {
	v := make([]FeatureFlag, 0, len(fm.flags))
	for _, value := range fm.flags {
		v = append(v, *value)
	}
	return v
}

// isFeatureEditingAllowed checks if the backend is properly configured to allow feature toggle changes from the UI
func (fm *FeatureManager) IsFeatureEditingAllowed() bool {
	return fm.Settings.AllowEditing && fm.Settings.UpdateWebhook != ""
}

// indicate if a change has been made (not that accurate, but better than nothing)
func (fm *FeatureManager) IsRestartRequired() bool {
	return fm.restartRequired
}

// Flags that can be edited
func (fm *FeatureManager) IsEditableFromAdminPage(key string) bool {
	flag, ok := fm.flags[key]
	if !ok ||
		!fm.IsFeatureEditingAllowed() ||
		!flag.AllowSelfServe ||
		flag.Name == FlagFeatureToggleAdminPage {
		return false
	}
	return flag.Stage == FeatureStageGeneralAvailability ||
		flag.Stage == FeatureStagePublicPreview ||
		flag.Stage == FeatureStageDeprecated
}

// Flags that should not be shown in the UI (regardless of their state)
func (fm *FeatureManager) IsHiddenFromAdminPage(key string, lenient bool) bool {
	_, hide := fm.Settings.HiddenToggles[key]
	flag, ok := fm.flags[key]
	if !ok || flag.HideFromAdminPage || hide {
		return true // unknown flag (should we show it as a warning!)
	}

	// Explicitly hidden from configs
	_, found := fm.Settings.HiddenToggles[key]
	if found {
		return true
	}
	if lenient {
		return false
	}

	return flag.Stage == FeatureStageUnknown ||
		flag.Stage == FeatureStageExperimental ||
		flag.Stage == FeatureStagePrivatePreview
}

// Get the flags that were explicitly set on startup
func (fm *FeatureManager) GetStartupFlags() map[string]bool {
	return fm.startup
}

// Perhaps expose the flag warnings
func (fm *FeatureManager) GetWarning() map[string]string {
	return fm.warnings
}

func (fm *FeatureManager) SetRestartRequired() {
	fm.restartRequired = true
}

// ############# Test Functions #############

func WithFeatures(spec ...any) FeatureToggles {
	return WithManager(spec...)
}

// WithFeatures is used to define feature toggles for testing.
// The arguments are a list of strings that are optionally followed by a boolean value for example:
// WithFeatures([]any{"my_feature", "other_feature"}) or WithFeatures([]any{"my_feature", true})
func WithManager(spec ...any) *FeatureManager {
	count := len(spec)
	features := make(map[string]*FeatureFlag, count)
	enabled := make(map[string]bool, count)

	idx := 0
	for idx < count {
		key := fmt.Sprintf("%v", spec[idx])
		val := true
		idx++
		if idx < count && reflect.TypeOf(spec[idx]).Kind() == reflect.Bool {
			val = spec[idx].(bool)
			idx++
		}

		features[key] = &FeatureFlag{Name: key}
		if val {
			enabled[key] = true
		}
	}

	return &FeatureManager{enabled: enabled, flags: features, startup: enabled, warnings: map[string]string{}}
}

// WithFeatureManager is used to define feature toggle manager for testing.
// It should be used when your test feature toggles require metadata beyond `Name` and `Enabled`.
// You should provide a feature toggle Name at a minimum.
func WithFeatureManager(cfg setting.FeatureMgmtSettings, flags []*FeatureFlag, disabled ...string) *FeatureManager {
	count := len(flags)
	features := make(map[string]*FeatureFlag, count)
	enabled := make(map[string]bool, count)

	dis := make(map[string]bool)
	for _, v := range disabled {
		dis[v] = true
	}

	for _, f := range flags {
		if f.Name == "" {
			continue
		}
		features[f.Name] = f
		enabled[f.Name] = !dis[f.Name]
	}

	return &FeatureManager{
		Settings: cfg,
		enabled:  enabled,
		flags:    features,
		startup:  enabled,
		warnings: map[string]string{},
	}
}
