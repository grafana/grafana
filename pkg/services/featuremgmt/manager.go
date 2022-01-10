package featuremgmt

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
)

type FeatureManager struct {
	flags   map[string]setting.FeatureFlag
	enabled map[string]bool // only the "on" values
}

var (
	_ setting.FeatureToggles = (*FeatureManager)(nil)
)

// This will
func (ff *FeatureManager) registerFlags(flags ...setting.FeatureFlag) {
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
func (ff *FeatureManager) IsEnabled(flag string) bool {
	return ff.enabled[flag]
}

// GetEnabled returns a map contaning only the features that are enabled
func (ff *FeatureManager) GetEnabled() []string {
	enabled := make([]string, 0, len(ff.enabled))
	for key, val := range ff.enabled {
		if val {
			enabled = append(enabled, key)
		}
	}
	return enabled
}

// GetFlags returns all flag definitions
func (ff *FeatureManager) GetFlags() []setting.FeatureFlag {
	v := make([]setting.FeatureFlag, 0, len(ff.flags))
	for _, value := range ff.flags {
		v = append(v, value)
	}
	return v
}

func (ff FeatureManager) MarshalJSON() ([]byte, error) {
	res := make(map[string]interface{}, 3)
	res["enabled"] = ff.enabled

	vv := make([]setting.FeatureFlag, 0, len(ff.flags))
	for _, v := range ff.flags {
		vv = append(vv, v)
	}

	res["info"] = vv
	//res["notice"] = ft.notice
	return json.Marshal(res)
}
