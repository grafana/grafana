package featuremgmt

import (
	"context"
	"sort"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
	"golang.org/x/exp/maps"
)

var wrongTypeResolution = openfeature.ProviderResolutionDetail{
	ResolutionError: openfeature.NewTypeMismatchResolutionError("provider only supports boolean flags"),
	Reason:          openfeature.ErrorReason,
}

type staticProvider struct {
	isDevMode       bool
	restartRequired bool
	flags           map[string]*FeatureFlag
	enabled         map[string]bool
	startup         map[string]bool
	warnings        map[string]string

	log log.Logger
}

func newStaticProvider(cfg *setting.Cfg) (openfeature.FeatureProvider, error) {
	p := &staticProvider{
		isDevMode: cfg.Env != setting.Prod,
		flags:     make(map[string]*FeatureFlag, 30),
		enabled:   make(map[string]bool),
		startup:   make(map[string]bool),
		warnings:  make(map[string]string),
		log:       log.New("static-provider"),
	}

	p.registerFlags(standardFeatureFlags...)
	// Load the flags from `custom.ini` files
	flags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return p, err
	}
	for key, val := range flags {
		_, ok := p.flags[key]
		if !ok {
			switch key {
			// renamed the flag so it supports more panels
			case "autoMigrateGraphPanels":
				key = FlagAutoMigrateOldPanels
			default:
				p.flags[key] = &FeatureFlag{
					Name:  key,
					Stage: FeatureStageUnknown,
				}
				p.warnings[key] = "unknown flag in config"
			}
		}
		p.startup[key] = val
	}

	// update the values
	p.update()

	// Log the enabled feature toggles at startup
	enabled := sort.StringSlice(maps.Keys(p.enabled))
	logctx := make([]any, len(enabled)*2)
	for i, k := range enabled {
		logctx[(i * 2)] = k
		logctx[(i*2)+1] = true
	}
	p.log.Info("FeatureToggles", logctx...)

	return p, nil
}

func (s staticProvider) Metadata() openfeature.Metadata {
	return openfeature.Metadata{Name: "GrafanaStaticProvider"}
}

func (s staticProvider) BooleanEvaluation(ctx context.Context, flag string, defaultValue bool, evalCtx openfeature.FlattenedContext) openfeature.BoolResolutionDetail {
	_, enabled := s.enabled[flag]
	return openfeature.BoolResolutionDetail{
		Value: enabled,
		ProviderResolutionDetail: openfeature.ProviderResolutionDetail{
			Reason: openfeature.StaticReason,
		},
	}
}

func (s staticProvider) StringEvaluation(ctx context.Context, flag string, defaultValue string, evalCtx openfeature.FlattenedContext) openfeature.StringResolutionDetail {
	return openfeature.StringResolutionDetail{ProviderResolutionDetail: wrongTypeResolution}
}

func (s staticProvider) FloatEvaluation(ctx context.Context, flag string, defaultValue float64, evalCtx openfeature.FlattenedContext) openfeature.FloatResolutionDetail {
	return openfeature.FloatResolutionDetail{ProviderResolutionDetail: wrongTypeResolution}
}

func (s staticProvider) IntEvaluation(ctx context.Context, flag string, defaultValue int64, evalCtx openfeature.FlattenedContext) openfeature.IntResolutionDetail {
	return openfeature.IntResolutionDetail{ProviderResolutionDetail: wrongTypeResolution}
}

func (s staticProvider) ObjectEvaluation(ctx context.Context, flag string, defaultValue interface{}, evalCtx openfeature.FlattenedContext) openfeature.InterfaceResolutionDetail {
	return openfeature.InterfaceResolutionDetail{ProviderResolutionDetail: wrongTypeResolution}
}

func (s staticProvider) Hooks() []openfeature.Hook {
	return []openfeature.Hook{}
}

func (s staticProvider) GetEnabled(ctx context.Context) map[string]bool {
	return s.enabled
}

func (s staticProvider) GetFlags() []FeatureFlag {
	v := make([]FeatureFlag, 0, len(s.flags))
	for _, value := range s.flags {
		v = append(v, *value)
	}
	return v
}

func (s staticProvider) GetStartupFlags() map[string]bool {
	return s.startup
}

func (s staticProvider) GetWarnings() map[string]string {
	return s.warnings
}

func (s staticProvider) SetRestartRequired() {
	s.restartRequired = true
}

func (s staticProvider) IsRestartRequired() bool {
	return s.restartRequired
}

func (s *staticProvider) registerFlags(flags ...FeatureFlag) {
	for _, add := range flags {
		if add.Name == "" {
			continue // skip it with warning?
		}
		flag, ok := s.flags[add.Name]
		if !ok {
			f := add // make a copy
			s.flags[add.Name] = &f
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
	s.update()
}

func (s *staticProvider) update() {
	enabled := make(map[string]bool)
	for _, flag := range s.flags {
		// if grafana cannot run the feature, omit metrics around it
		ok, reason := s.meetsRequirements(flag)
		if !ok {
			s.warnings[flag.Name] = reason
			continue
		}

		// Update the registry
		track := 0.0

		startup, ok := s.startup[flag.Name]
		if startup || (!ok && flag.Expression == "true") {
			track = 1
			enabled[flag.Name] = true
		}

		// Register value with prometheus metric
		featureToggleInfo.WithLabelValues(flag.Name).Set(track)
	}
	s.enabled = enabled
}

func (s staticProvider) meetsRequirements(ff *FeatureFlag) (bool, string) {
	if ff.RequiresDevMode && !s.isDevMode {
		return false, "requires dev mode"
	}

	return true, ""
}
