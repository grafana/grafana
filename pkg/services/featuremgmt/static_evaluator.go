package featuremgmt

import (
	"context"
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
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

	flags, err := buildStaticFlagsMapFromCfg(cfg)
	if err != nil {
		return nil, err
	}

	return &staticEvaluator{
		flags:  flags,
		client: openfeature.NewDefaultClient(),
		log:    log.New("static-evaluator"),
	}, nil
}

// staticEvaluator implements StaticFlagEvaluator for static providers.
// It holds the flags map for type detection and listing, and uses the global
// OpenFeature client for evaluation.
type staticEvaluator struct {
	flags  map[string]memprovider.InMemoryFlag
	client openfeature.IClient
	log    log.Logger
}

func (s *staticEvaluator) EvalFlag(ctx context.Context, flagKey string) (goffmodel.OFREPEvaluateSuccessResponse, error) {
	flag, exists := s.flags[flagKey]
	if !exists {
		return goffmodel.OFREPEvaluateSuccessResponse{}, fmt.Errorf("flag %s not found", flagKey)
	}

	evalCtx := openfeature.TransactionContext(ctx)

	buildResponse := func(value any, variant string, metadata map[string]any) goffmodel.OFREPEvaluateSuccessResponse {
		return goffmodel.OFREPEvaluateSuccessResponse{
			Key:      flagKey,
			Value:    value,
			Reason:   "static provider evaluation result",
			Variant:  variant,
			Metadata: metadata,
		}
	}

	typedFlag := TypedFlag(flag)
	switch typedFlag.GetFlagType() {
	case FlagTypeBoolean:
		result, err := s.client.BooleanValueDetails(ctx, flagKey, false, evalCtx)
		if err != nil {
			return goffmodel.OFREPEvaluateSuccessResponse{}, fmt.Errorf("failed to evaluate flag %s: %w", flagKey, err)
		}
		return buildResponse(result.Value, result.Variant, result.FlagMetadata), nil

	case FlagTypeInteger:
		result, err := s.client.IntValueDetails(ctx, flagKey, 0, evalCtx)
		if err != nil {
			return goffmodel.OFREPEvaluateSuccessResponse{}, fmt.Errorf("failed to evaluate flag %s: %w", flagKey, err)
		}
		return buildResponse(result.Value, result.Variant, result.FlagMetadata), nil

	case FlagTypeFloat:
		result, err := s.client.FloatValueDetails(ctx, flagKey, 0.0, evalCtx)
		if err != nil {
			return goffmodel.OFREPEvaluateSuccessResponse{}, fmt.Errorf("failed to evaluate flag %s: %w", flagKey, err)
		}
		return buildResponse(result.Value, result.Variant, result.FlagMetadata), nil

	case FlagTypeString:
		result, err := s.client.StringValueDetails(ctx, flagKey, "", evalCtx)
		if err != nil {
			return goffmodel.OFREPEvaluateSuccessResponse{}, fmt.Errorf("failed to evaluate flag %s: %w", flagKey, err)
		}
		return buildResponse(result.Value, result.Variant, result.FlagMetadata), nil

	case FlagTypeObject:
		result, err := s.client.ObjectValueDetails(ctx, flagKey, map[string]any{}, evalCtx)
		if err != nil {
			return goffmodel.OFREPEvaluateSuccessResponse{}, fmt.Errorf("failed to evaluate flag %s: %w", flagKey, err)
		}
		return buildResponse(result.Value, result.Variant, result.FlagMetadata), nil

	default:
		return goffmodel.OFREPEvaluateSuccessResponse{}, fmt.Errorf("unsupported flag type for %s", flagKey)
	}
}

func (s *staticEvaluator) EvalAllFlags(ctx context.Context) (goffmodel.OFREPBulkEvaluateSuccessResponse, error) {
	allFlags := make([]goffmodel.OFREPFlagBulkEvaluateSuccessResponse, 0, len(s.flags))
	for flagKey := range s.flags {
		result, err := s.EvalFlag(ctx, flagKey)
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
