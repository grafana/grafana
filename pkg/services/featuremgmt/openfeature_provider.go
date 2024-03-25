package featuremgmt

import (
	"context"
	"errors"
	"fmt"
	"unicode/utf8"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/open-feature/go-sdk/openfeature"
)

// FeatureProvider is an OpenFeature provider with a few added methods
// from the FeatureManager mostly around supporting the Feature Toggle Admin UI.
type FeatureProvider interface {
	openfeature.FeatureProvider

	// GetEnabled returns a map containing only the features that are enabled
	GetEnabled(ctx context.Context) map[string]bool

	// GetFlags returns all flag definitions
	GetFlags() []FeatureFlag

	// GetFlag returns the named flag definition or nil if not found
	GetFlag(key string) *FeatureFlag

	// GetStartupFlags returns the flags that were explicitly set on startup
	GetStartupFlags() map[string]bool

	// GetWarnings returns any warnings about the flags
	GetWarnings() map[string]string

	// SetRestartRequired indicates that a change has been made that requires a
	// restart
	SetRestartRequired()

	// IsRestartRequired - indicate if a change has been made that requires a
	// restart (not that accurate, but better than nothing)
	IsRestartRequired() bool
}

// newProvider returns an OpenFeature Provider with static values injected
// at startup by values from the Grafana configuration (the feature_toggles
// section).
// It only supports boolean flags, attempting to evaluate other types will
// result in an error.
func newProvider(devMode bool, logger log.Logger) *staticBoolProvider {
	return &staticBoolProvider{
		isDevMode: devMode,
		flags:     map[string]*FeatureFlag{},
		enabled:   map[string]bool{},
		startup:   map[string]bool{},
		warnings:  map[string]string{},
		log:       logger,
	}
}

type staticBoolProvider struct {
	boolOnlyProvider
	isDevMode       bool
	restartRequired bool

	flags    map[string]*FeatureFlag
	enabled  map[string]bool   // only the "on" values
	startup  map[string]bool   // the explicit values registered at startup
	warnings map[string]string // potential warnings about the flag

	log log.Logger
}

var _ FeatureProvider = (*staticBoolProvider)(nil)

func (p *staticBoolProvider) GetEnabled(ctx context.Context) map[string]bool {
	return p.enabled
}

func (p *staticBoolProvider) GetFlag(key string) *FeatureFlag {
	return p.flags[key]
}

func (p *staticBoolProvider) GetFlags() []FeatureFlag {
	v := make([]FeatureFlag, 0, len(p.flags))
	for _, value := range p.flags {
		v = append(v, *value)
	}
	return v
}

func (p *staticBoolProvider) GetStartupFlags() map[string]bool {
	return p.startup
}

func (p *staticBoolProvider) GetWarnings() map[string]string {
	return p.warnings
}

func (p *staticBoolProvider) SetRestartRequired() {
	p.restartRequired = true
}

func (p *staticBoolProvider) IsRestartRequired() bool {
	return p.restartRequired
}

func (p *staticBoolProvider) register(configFlags map[string]bool, startupFlags ...FeatureFlag) {
	for _, add := range startupFlags {
		if add.Name == "" {
			p.log.Warn("skipping flag with empty name")
			continue
		}

		// skip duplicates
		flag, ok := p.flags[add.Name]
		if !ok {
			f := add // make a copy
			p.flags[add.Name] = &f
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
	p.update()

	// set up the startup values
	for key, val := range configFlags {
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

	// update the values again (?)
	p.update()
}

// meetsRequirements checks if grafana is able to run the given feature due to dev mode or licensing requirements
func (p *staticBoolProvider) meetsRequirements(ff *FeatureFlag) (bool, string) {
	if ff.RequiresDevMode && !p.isDevMode {
		return false, "requires dev mode"
	}

	return true, ""
}

func (p *staticBoolProvider) update() {
	enabled := map[string]bool{}
	for _, flag := range p.flags {
		// if grafana cannot run the feature, omit metrics around it
		ok, reason := p.meetsRequirements(flag)
		if !ok {
			p.warnings[flag.Name] = reason
			continue
		}

		// Update the registry
		track := 0.0

		startup, ok := p.startup[flag.Name]
		if startup || (!ok && flag.Expression == "true") {
			track = 1.0
			enabled[flag.Name] = true
		}

		// Register value with prometheus metric
		featureToggleInfo.WithLabelValues(flag.Name).Set(track)
	}
	p.enabled = enabled
}

// interface guard
var _ openfeature.FeatureProvider = (*staticBoolProvider)(nil)

// Metadata returns the metadata of the provider
func (p *staticBoolProvider) Metadata() openfeature.Metadata {
	return openfeature.Metadata{Name: "GrafanaStaticBoolProvider"}
}

// Hooks returns hooks defined by this provider
func (p *staticBoolProvider) Hooks() []openfeature.Hook {
	return []openfeature.Hook{}
}

func (p *staticBoolProvider) BooleanEvaluation(ctx context.Context, flag string, defaultValue bool, evalCtx openfeature.FlattenedContext) openfeature.BoolResolutionDetail {
	_, enabled := p.enabled[flag]
	return openfeature.BoolResolutionDetail{
		Value: enabled,
		ProviderResolutionDetail: openfeature.ProviderResolutionDetail{
			Reason: openfeature.StaticReason,
		},
	}
}

var wrongTypeResolution = openfeature.ProviderResolutionDetail{
	ResolutionError: openfeature.NewTypeMismatchResolutionError("provider only supports boolean flags"),
	Reason:          openfeature.ErrorReason,
}

type boolOnlyProvider struct{}

func (boolOnlyProvider) StringEvaluation(ctx context.Context, flag string, defaultValue string, evalCtx openfeature.FlattenedContext) openfeature.StringResolutionDetail {
	return openfeature.StringResolutionDetail{ProviderResolutionDetail: wrongTypeResolution}
}

func (boolOnlyProvider) FloatEvaluation(ctx context.Context, flag string, defaultValue float64, evalCtx openfeature.FlattenedContext) openfeature.FloatResolutionDetail {
	return openfeature.FloatResolutionDetail{ProviderResolutionDetail: wrongTypeResolution}
}

func (boolOnlyProvider) IntEvaluation(ctx context.Context, flag string, defaultValue int64, evalCtx openfeature.FlattenedContext) openfeature.IntResolutionDetail {
	return openfeature.IntResolutionDetail{ProviderResolutionDetail: wrongTypeResolution}
}

func (boolOnlyProvider) ObjectEvaluation(ctx context.Context, flag string, defaultValue interface{}, evalCtx openfeature.FlattenedContext) openfeature.InterfaceResolutionDetail {
	return openfeature.InterfaceResolutionDetail{ProviderResolutionDetail: wrongTypeResolution}
}

// TestClient returns a new OpenFeature client with the given flags enabled.
// This must only be used in tests.
func TestClient(enabled ...string) openfeature.IClient {
	// flags := make([]FeatureFlag, 0, len(enabled))
	// for _, v := range enabled {
	// 	flags = append(flags, FeatureFlag{Name: v})
	// }
	prov := newProvider(false, log.New("featuremgmt"))
	// prov.register(nil, flags...)

	for _, v := range enabled {
		prov.enabled[v] = true
		prov.flags[v] = &FeatureFlag{Name: v}
		prov.startup[v] = true
	}

	return &testClient{provider: prov}
}

// testClient is adapted from the code for openfeature.Client and modified so
// the provider is wired directly to the client for deterministic feature
// evaluation
type testClient struct {
	provider *staticBoolProvider
}

var _ openfeature.IClient = (*testClient)(nil)

func (c *testClient) Metadata() openfeature.ClientMetadata {
	return openfeature.NewClientMetadata("testClient")
}

func (c *testClient) AddHooks(hooks ...openfeature.Hook) {}
func (c *testClient) AddHandler(eventType openfeature.EventType, callback openfeature.EventCallback) {
}
func (c *testClient) RemoveHandler(eventType openfeature.EventType, callback openfeature.EventCallback) {
}
func (c *testClient) SetEvaluationContext(evalCtx openfeature.EvaluationContext) {}
func (c *testClient) EvaluationContext() openfeature.EvaluationContext {
	return openfeature.EvaluationContext{}
}

func flattenContext(evalCtx openfeature.EvaluationContext) openfeature.FlattenedContext {
	flatCtx := evalCtx.Attributes()
	if evalCtx.TargetingKey() != "" {
		flatCtx[openfeature.TargetingKey] = evalCtx.TargetingKey()
	}

	return flatCtx
}

func (c *testClient) evaluate(
	ctx context.Context, flag string, flagType openfeature.Type, defaultValue any, evalCtx openfeature.EvaluationContext) (openfeature.InterfaceEvaluationDetails, error) {
	evalDetails := openfeature.InterfaceEvaluationDetails{
		Value:             defaultValue,
		EvaluationDetails: openfeature.EvaluationDetails{FlagKey: flag, FlagType: flagType},
	}

	if !utf8.Valid([]byte(flag)) {
		return evalDetails, openfeature.NewParseErrorResolutionError("flag key is not a UTF-8 encoded string")
	}

	flatCtx := flattenContext(evalCtx)
	var resolution openfeature.InterfaceResolutionDetail
	switch flagType {
	case openfeature.Object:
		resolution = c.provider.ObjectEvaluation(ctx, flag, defaultValue, flatCtx)
	case openfeature.Boolean:
		defValue := defaultValue.(bool)
		res := c.provider.BooleanEvaluation(ctx, flag, defValue, flatCtx)
		resolution.ProviderResolutionDetail = res.ProviderResolutionDetail
		resolution.Value = res.Value
	case openfeature.String:
		defValue := defaultValue.(string)
		res := c.provider.StringEvaluation(ctx, flag, defValue, flatCtx)
		resolution.ProviderResolutionDetail = res.ProviderResolutionDetail
		resolution.Value = res.Value
	case openfeature.Float:
		defValue := defaultValue.(float64)
		res := c.provider.FloatEvaluation(ctx, flag, defValue, flatCtx)
		resolution.ProviderResolutionDetail = res.ProviderResolutionDetail
		resolution.Value = res.Value
	case openfeature.Int:
		defValue := defaultValue.(int64)
		res := c.provider.IntEvaluation(ctx, flag, defValue, flatCtx)
		resolution.ProviderResolutionDetail = res.ProviderResolutionDetail
		resolution.Value = res.Value
	}

	err := resolution.Error()
	if err != nil {
		err = fmt.Errorf("error code: %w", err)
		evalDetails.ResolutionDetail = resolution.ResolutionDetail()
		evalDetails.Reason = openfeature.ErrorReason
		return evalDetails, err
	}
	evalDetails.Value = resolution.Value
	evalDetails.ResolutionDetail = resolution.ResolutionDetail()

	return evalDetails, nil
}

func (c *testClient) BooleanValueDetails(ctx context.Context, flag string, defaultValue bool, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) (openfeature.BooleanEvaluationDetails, error) {
	evalDetails, err := c.evaluate(ctx, flag, openfeature.Boolean, defaultValue, evalCtx)
	if err != nil {
		return openfeature.BooleanEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}, err
	}

	value, ok := evalDetails.Value.(bool)
	if !ok {
		err := errors.New("evaluated value is not a boolean")
		boolEvalDetails := openfeature.BooleanEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}
		boolEvalDetails.EvaluationDetails.ErrorCode = openfeature.TypeMismatchCode
		boolEvalDetails.EvaluationDetails.ErrorMessage = err.Error()

		return boolEvalDetails, err
	}

	return openfeature.BooleanEvaluationDetails{
		Value:             value,
		EvaluationDetails: evalDetails.EvaluationDetails,
	}, nil
}

func (c *testClient) StringValueDetails(ctx context.Context, flag string, defaultValue string, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) (openfeature.StringEvaluationDetails, error) {
	evalDetails, err := c.evaluate(ctx, flag, openfeature.String, defaultValue, evalCtx)
	if err != nil {
		return openfeature.StringEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}, err
	}

	value, ok := evalDetails.Value.(string)
	if !ok {
		err := errors.New("evaluated value is not a string")
		stringEvalDetails := openfeature.StringEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}
		stringEvalDetails.EvaluationDetails.ErrorCode = openfeature.TypeMismatchCode
		stringEvalDetails.EvaluationDetails.ErrorMessage = err.Error()

		return stringEvalDetails, err
	}

	return openfeature.StringEvaluationDetails{
		Value:             value,
		EvaluationDetails: evalDetails.EvaluationDetails,
	}, nil
}

func (c *testClient) FloatValueDetails(ctx context.Context, flag string, defaultValue float64, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) (openfeature.FloatEvaluationDetails, error) {
	evalDetails, err := c.evaluate(ctx, flag, openfeature.Float, defaultValue, evalCtx)
	if err != nil {
		return openfeature.FloatEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}, err
	}

	value, ok := evalDetails.Value.(float64)
	if !ok {
		err := errors.New("evaluated value is not a float")
		floatEvalDetails := openfeature.FloatEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}
		floatEvalDetails.EvaluationDetails.ErrorCode = openfeature.TypeMismatchCode
		floatEvalDetails.EvaluationDetails.ErrorMessage = err.Error()

		return floatEvalDetails, err
	}

	return openfeature.FloatEvaluationDetails{
		Value:             value,
		EvaluationDetails: evalDetails.EvaluationDetails,
	}, nil
}

func (c *testClient) IntValueDetails(ctx context.Context, flag string, defaultValue int64, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) (openfeature.IntEvaluationDetails, error) {
	evalDetails, err := c.evaluate(ctx, flag, openfeature.Int, defaultValue, evalCtx)
	if err != nil {
		return openfeature.IntEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}, err
	}

	value, ok := evalDetails.Value.(int64)
	if !ok {
		err := errors.New("evaluated value is not an int")
		intEvalDetails := openfeature.IntEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}
		intEvalDetails.EvaluationDetails.ErrorCode = openfeature.TypeMismatchCode
		intEvalDetails.EvaluationDetails.ErrorMessage = err.Error()

		return intEvalDetails, err
	}

	return openfeature.IntEvaluationDetails{
		Value:             value,
		EvaluationDetails: evalDetails.EvaluationDetails,
	}, nil
}

func (c *testClient) ObjectValueDetails(ctx context.Context, flag string, defaultValue interface{}, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) (openfeature.InterfaceEvaluationDetails, error) {
	evalDetails, err := c.evaluate(ctx, flag, openfeature.Object, defaultValue, evalCtx)
	if err != nil {
		return openfeature.InterfaceEvaluationDetails{
			Value:             defaultValue,
			EvaluationDetails: evalDetails.EvaluationDetails,
		}, err
	}

	return evalDetails, nil
}

func (c *testClient) BooleanValue(ctx context.Context, flag string, defaultValue bool, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) (bool, error) {
	details, err := c.BooleanValueDetails(ctx, flag, defaultValue, evalCtx, options...)
	if err != nil {
		return false, err
	}

	return details.Value, nil
}

func (c *testClient) StringValue(ctx context.Context, flag string, defaultValue string, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) (string, error) {
	details, err := c.StringValueDetails(ctx, flag, defaultValue, evalCtx, options...)
	if err != nil {
		return "", err
	}

	return details.Value, nil
}

func (c *testClient) FloatValue(ctx context.Context, flag string, defaultValue float64, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) (float64, error) {
	details, err := c.FloatValueDetails(ctx, flag, defaultValue, evalCtx, options...)
	if err != nil {
		return 0, err
	}

	return details.Value, nil
}

func (c *testClient) IntValue(ctx context.Context, flag string, defaultValue int64, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) (int64, error) {
	details, err := c.IntValueDetails(ctx, flag, defaultValue, evalCtx, options...)
	if err != nil {
		return 0, err
	}

	return details.Value, nil
}

func (c *testClient) ObjectValue(ctx context.Context, flag string, defaultValue interface{}, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) (interface{}, error) {
	details, err := c.ObjectValueDetails(ctx, flag, defaultValue, evalCtx, options...)
	if err != nil {
		return nil, err
	}

	return details.Value, nil
}

func (c *testClient) Boolean(ctx context.Context, flag string, defaultValue bool, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) bool {
	value, _ := c.BooleanValue(ctx, flag, defaultValue, evalCtx, options...)

	return value
}

func (c *testClient) String(ctx context.Context, flag string, defaultValue string, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) string {
	value, _ := c.StringValue(ctx, flag, defaultValue, evalCtx, options...)

	return value
}

func (c *testClient) Float(ctx context.Context, flag string, defaultValue float64, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) float64 {
	value, _ := c.FloatValue(ctx, flag, defaultValue, evalCtx, options...)

	return value
}

func (c *testClient) Int(ctx context.Context, flag string, defaultValue int64, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) int64 {
	value, _ := c.IntValue(ctx, flag, defaultValue, evalCtx, options...)

	return value
}

func (c *testClient) Object(ctx context.Context, flag string, defaultValue interface{}, evalCtx openfeature.EvaluationContext, options ...openfeature.Option) interface{} {
	value, _ := c.ObjectValue(ctx, flag, defaultValue, evalCtx, options...)

	return value
}
