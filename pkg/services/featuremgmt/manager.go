package featuremgmt

import (
	"context"
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/licensing"
)

var (
	_ FeatureToggles = (*FeatureManager)(nil)
)

type FeatureManager struct {
	isDevMod  bool
	licensing licensing.Licensing
	flags     map[string]*FeatureFlag
	enabled   map[string]bool // only the "on" values
	config    string          // path to config file
	vars      map[string]interface{}
	log       log.Logger
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
		if add.DocsURL != "" {
			flag.DocsURL = add.DocsURL
		}
		if add.Expression != "" {
			flag.Expression = add.Expression
		}

		// The most recently defined state
		if add.State != FeatureStateUnknown {
			flag.State = add.State
		}

		// Only gets more restrictive
		if add.RequiresDevMode {
			flag.RequiresDevMode = true
		}

		if add.RequiresLicense {
			flag.RequiresLicense = true
		}

		if add.RequiresRestart {
			flag.RequiresRestart = true
		}
	}

	// This will evaluate all flags
	fm.update()
}

// meetsRequirements checks if grafana is able to run the given feature due to dev mode or licensing requirements
func (fm *FeatureManager) meetsRequirements(ff *FeatureFlag) bool {
	if ff.RequiresDevMode && !fm.isDevMod {
		return false
	}

	if ff.RequiresLicense && (fm.licensing == nil || !fm.licensing.FeatureEnabled(ff.Name)) {
		return false
	}

	return true
}

// Update
func (fm *FeatureManager) update() {
	enabled := make(map[string]bool)
	for _, flag := range fm.flags {
		// if grafana cannot run the feature, omit metrics around it
		if !fm.meetsRequirements(flag) {
			continue
		}

		// Update the registry
		track := 0.0
		// TODO: CEL - expression
		if flag.Expression == "true" {
			track = 1
			enabled[flag.Name] = true
		}

		// Register value with prometheus metric
		featureToggleInfo.WithLabelValues(flag.Name).Set(track)
	}
	fm.enabled = enabled
}

// Run is called by background services
func (fm *FeatureManager) readFile() error {
	if fm.config == "" {
		return nil // not configured
	}

	cfg, err := readConfigFile(fm.config)
	if err != nil {
		return err
	}

	fm.registerFlags(cfg.Flags...)
	fm.vars = cfg.Vars

	return nil
}

// IsEnabled checks if a feature is enabled
func (fm *FeatureManager) IsEnabled(flag string) bool {
	return fm.enabled[flag]
}

// GetEnabled returns a map contaning only the features that are enabled
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

// WithFeatures is used to define feature toggles for testing.
// The arguments are a list of strings that are optionally followed by a boolean value for example:
// WithFeatures([]interface{}{"my_feature", "other_feature"}) or WithFeatures([]interface{}{"my_feature", true})
func WithFeatures(spec ...interface{}) *FeatureManager {
	count := len(spec)
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

		if val {
			enabled[key] = true
		}
	}

	return &FeatureManager{enabled: enabled}
}
