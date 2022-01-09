package featuremgmt

import (
	"encoding/json"
	"fmt"
	"reflect"
)

type flagManager struct {
	flags   map[string]FeatureFlag
	enabled map[string]bool // only the "on" values
}

// Make sure the manager interface is implemented
var (
	_ FeatureManager = (*flagManager)(nil)
)

// This will
func (ff *flagManager) registerFlags(flags ...FeatureFlag) {
	for _, add := range flags {
		if add.Name == "" {
			continue // skip it with warning?
		}
		flag, ok := ff.flags[add.Name]
		if !ok {
			ff.flags[add.Name] = add
			continue
		}

		// Selectivly update properties
		if add.Description != flag.Description {
			flag.Description = add.Description
		}
		if add.DocsURL != flag.DocsURL {
			flag.DocsURL = add.DocsURL
		}
		if add.Expression != flag.Expression {
			flag.Expression = add.Expression
		}

		// The least stable state
		if add.State != flag.State {
			// only define it downwards
			fmt.Printf("todo...")
		}

		// Only gets more restrictive
		if add.RequiresDevMode {
			flag.RequiresDevMode = true
		}
	}
}

// IsEnabled checks if a feature is enabled
func (ff *flagManager) IsEnabled(flag string) bool {
	return ff.enabled[flag]
}

// GetEnabled returns a map contaning only the features that are enabled
func (ff *flagManager) GetEnabled() map[string]bool {
	return ff.enabled
}

// GetFeatureToggles returns nice functions for each toggle
func (ff *flagManager) GetFeatureToggles() FeatureToggles {
	return FeatureToggles{
		manager: ff,
	}
}

// GetFlags returns all flag definitions
func (ff *flagManager) GetFlags() []FeatureFlag {
	v := make([]FeatureFlag, 0, len(ff.flags))
	for _, value := range ff.flags {
		v = append(v, value)
	}
	return v
}

// WithFeatures is used to define feature toggles for testing.
// The arguments are a list of strings that are optionally followed by a boolean value
func WithFeatures(spec ...interface{}) FeatureManager {
	count := len(spec)
	enabled := make(map[string]bool, count)
	flags := make(map[string]FeatureFlag, count)

	idx := 0
	for idx < count {
		key := fmt.Sprintf("%v", spec[idx])
		val := true
		idx++
		if idx < count && reflect.TypeOf(spec[idx]).Kind() == reflect.Bool {
			val = spec[idx].(bool)
			idx++
		}

		flags[key] = FeatureFlag{
			Name:       key,
			Expression: fmt.Sprintf("%t", val),
			State:      BetaState, // unknown!
		}
		if val {
			enabled[key] = true
		}
	}

	return &flagManager{
		enabled: enabled,
		flags:   flags,
	}
}

func WithToggles(spec ...interface{}) FeatureToggles {
	return WithFeatures(spec).GetFeatureToggles()
}

func (ff flagManager) MarshalJSON() ([]byte, error) {
	res := make(map[string]interface{}, 3)
	res["enabled"] = ff.enabled

	vv := make([]FeatureFlag, 0, len(ff.flags))
	for _, v := range ff.flags {
		vv = append(vv, v)
	}

	res["info"] = vv
	//res["notice"] = ft.notice
	return json.Marshal(res)
}
