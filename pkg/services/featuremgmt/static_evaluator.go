package featuremgmt

import (
	"context"
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	goffmodel "github.com/thomaspoignant/go-feature-flag/cmd/relayproxy/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// StaticFlagEvaluator provides methods for evaluating static feature flags
// it is only used when static provider is configured
type StaticFlagEvaluator interface {
	EvalFlag(ctx context.Context, flagKey string) (goffmodel.OFREPEvaluateSuccessResponse, error)
	EvalAllFlags(ctx context.Context) (goffmodel.OFREPBulkEvaluateSuccessResponse, error)
}

// CreateStaticEvaluator is a dependency for ofrep APIBuilder
func CreateStaticEvaluator(cfg *setting.Cfg) (StaticFlagEvaluator, error) {
	if cfg.OpenFeature.ProviderType != setting.StaticProviderType {
		return nil, fmt.Errorf("provider is not a static provider, type %s", setting.StaticProviderType)
	}

	typedFlags, err := setting.ReadTypedFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return nil, fmt.Errorf("failed to read feature flags from config: %w", err)
	}

	staticProvider, err := newStaticProvider(typedFlags)
	if err != nil {
		return nil, fmt.Errorf("failed to create static provider: %w", err)
	}

	p, ok := staticProvider.(*inMemoryBulkProvider)
	if !ok {
		return nil, fmt.Errorf("static provider is not of type inMemoryBulkProvider")
	}

	c := openfeature.NewDefaultClient()

	return &staticEvaluator{
		provider: p,
		client:   c,
		log:      log.New("static-evaluator"),
	}, nil
}

// staticEvaluator implements StaticFlagEvaluator for static providers
type staticEvaluator struct {
	provider *inMemoryBulkProvider
	client   openfeature.IClient
	log      log.Logger
}

func (s *staticEvaluator) EvalFlag(ctx context.Context, flagKey string) (goffmodel.OFREPEvaluateSuccessResponse, error) {
	return s.evaluateFlagWithTypeDetection(ctx, flagKey)
}

func (s *staticEvaluator) EvalAllFlags(ctx context.Context) (goffmodel.OFREPBulkEvaluateSuccessResponse, error) {
	flags, err := s.provider.ListFlags()
	if err != nil {
		return goffmodel.OFREPBulkEvaluateSuccessResponse{}, fmt.Errorf("static provider failed to list all flags: %w", err)
	}

	allFlags := make([]goffmodel.OFREPFlagBulkEvaluateSuccessResponse, 0, len(flags))
	for _, flagKey := range flags {
		result, err := s.evaluateFlagWithTypeDetection(ctx, flagKey)
		if err != nil {
			s.log.Error("failed to evaluate flag during bulk evaluation", "flagKey", flagKey, "error", err)
			continue
		}

		allFlags = append(allFlags, goffmodel.OFREPFlagBulkEvaluateSuccessResponse{
			OFREPEvaluateSuccessResponse: result,
		})
	}

	return goffmodel.OFREPBulkEvaluateSuccessResponse{Flags: allFlags}, nil
}

// evaluateFlagWithTypeDetection tries different flag types and returns the first successful evaluation result
func (s *staticEvaluator) evaluateFlagWithTypeDetection(ctx context.Context, flagKey string) (goffmodel.OFREPEvaluateSuccessResponse, error) {
	// Try boolean evaluation first for backward compatibility
	result, err := s.client.BooleanValueDetails(ctx, flagKey, false, openfeature.TransactionContext(ctx))
	if err == nil {
		return goffmodel.OFREPEvaluateSuccessResponse{
			Key:      flagKey,
			Value:    result.Value,
			Reason:   "static provider evaluation result",
			Variant:  result.Variant,
			Metadata: result.FlagMetadata,
		}, nil
	}

	// If boolean evaluation fails, try other types
	s.log.Debug("boolean evaluation failed, trying other types", "flagKey", flagKey, "error", err)

	// Try string evaluation
	if stringResult, stringErr := s.client.StringValueDetails(ctx, flagKey, "", openfeature.TransactionContext(ctx)); stringErr == nil {
		return goffmodel.OFREPEvaluateSuccessResponse{
			Key:      flagKey,
			Value:    stringResult.Value,
			Reason:   "static provider evaluation result",
			Variant:  stringResult.Variant,
			Metadata: stringResult.FlagMetadata,
		}, nil
	}

	// Try number evaluation
	if numberResult, numberErr := s.client.FloatValueDetails(ctx, flagKey, 0.0, openfeature.TransactionContext(ctx)); numberErr == nil {
		return goffmodel.OFREPEvaluateSuccessResponse{
			Key:      flagKey,
			Value:    numberResult.Value,
			Reason:   "static provider evaluation result",
			Variant:  numberResult.Variant,
			Metadata: numberResult.FlagMetadata,
		}, nil
	}

	// Try object evaluation
	if objectResult, objectErr := s.client.ObjectValueDetails(ctx, flagKey, map[string]interface{}{}, openfeature.TransactionContext(ctx)); objectErr == nil {
		return goffmodel.OFREPEvaluateSuccessResponse{
			Key:      flagKey,
			Value:    objectResult.Value,
			Reason:   "static provider evaluation result",
			Variant:  objectResult.Variant,
			Metadata: objectResult.FlagMetadata,
		}, nil
	}

	// If all evaluations fail, return the original boolean error
	return goffmodel.OFREPEvaluateSuccessResponse{}, fmt.Errorf("failed to evaluate flag %s: %w", flagKey, err)
}
