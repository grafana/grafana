package featuremgmt

import (
	"context"
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

type FeatureManager struct {
	flags   map[string]*FeatureFlag
	enabled map[string]bool // only the "on" values
	toggles *FeatureToggles
	config  string // path to config file
}

// This will
func (ff *FeatureManager) registerFlags(flags ...FeatureFlag) {
	for idx, add := range flags {
		if add.Name == "" {
			continue // skip it with warning?
		}
		flag, ok := ff.flags[add.Name]
		if !ok {
			ff.flags[add.Name] = &flags[idx]
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

// Update
func (ff *FeatureManager) evaluate() {
	enabled := make(map[string]bool)
	for _, flag := range ff.flags {
		val := flag.Expression == "true"

		// Update the registry
		track := 0.0
		if val {
			track = 1
			enabled[flag.Name] = true
		}

		// Register value with prometheus metric
		featureToggleInfo.WithLabelValues(flag.Name).Set(track)
	}
	ff.enabled = enabled
}

// Run is called by background services
func (ff *FeatureManager) Run(ctx context.Context) error {
	fmt.Printf("RUN!!!!")
	return nil
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

// IsEnabled checks if a feature is enabled
func (ff *FeatureManager) Toggles() *FeatureToggles {
	if ff.toggles == nil {
		ff.toggles = &FeatureToggles{manager: ff}
	}
	return ff.toggles
}

// GetFlags returns all flag definitions
func (ff *FeatureManager) GetFlags() []FeatureFlag {
	v := make([]FeatureFlag, 0, len(ff.flags))
	for _, value := range ff.flags {
		v = append(v, *value)
	}
	return v
}

func (ff FeatureManager) HandleGetSettings(c *models.ReqContext) {
	res := make(map[string]interface{}, 3)
	res["enabled"] = ff.enabled

	vv := make([]*FeatureFlag, 0, len(ff.flags))
	for _, v := range ff.flags {
		vv = append(vv, v)
	}

	res["info"] = vv
	//res["notice"] = ft.notice

	response.JSON(200, res).WriteTo(c)
}

// WithFeatures is used to define feature toggles for testing.
// The arguments are a list of strings that are optionally followed by a boolean value
func WithFeatures(spec ...interface{}) *FeatureManager {
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
			Name: key,
		}

		if val {
			enabled[key] = true
		}
	}

	return &FeatureManager{enabled: enabled}
}

func WithToggles(spec ...interface{}) *FeatureToggles {
	return &FeatureToggles{
		manager: WithFeatures(spec...),
	}
}
