package featuremgmt

import (
	"context"
	"fmt"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
)

// StaticFlagEvaluator provides methods for evaluating static feature flags
// it is only used when static provider is configured
type StaticFlagEvaluator interface {
	EvalFlag(ctx context.Context, flagKey string) (openfeature.BooleanEvaluationDetails, error)
	EvalAllFlags(ctx context.Context) (OFREPBulkResponse, error)
}

// ProvideStaticEvaluator creates a static evaluator from configuration
// This can be used in wire dependency injection
func ProvideStaticEvaluator(cfg *setting.Cfg) (StaticFlagEvaluator, error) {
	if cfg.OpenFeature.ProviderType == setting.GOFFProviderType {
		l := log.New("static-evaluator")
		l.Debug("cannot create static evaluator if configured provider is goff")
		return &staticEvaluator{}, nil
	}

	confFlags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return nil, fmt.Errorf("failed to read feature toggles from config: %w", err)
	}

	return createStaticEvaluator(cfg.OpenFeature.ProviderType, cfg.OpenFeature.URL, confFlags)
}

// createStaticEvaluator evaluator that allows evaluating static flags from config.ini
func createStaticEvaluator(providerType string, u *url.URL, staticFlags map[string]bool) (StaticFlagEvaluator, error) {
	provider, err := createProvider(providerType, u, staticFlags, nil, nil)
	if err != nil {
		return nil, err
	}

	staticProvider, ok := provider.(*inMemoryBulkProvider)
	if !ok {
		return nil, fmt.Errorf("provider is not a static provider")
	}

	client, err := createClient(provider)
	if err != nil {
		return nil, err
	}

	return &staticEvaluator{
		provider: staticProvider,
		client:   client,
		log:      log.New("static-evaluator"),
	}, nil
}

// staticEvaluator implements StaticFlagEvaluator for static providers
type staticEvaluator struct {
	provider *inMemoryBulkProvider
	client   openfeature.IClient
	log      log.Logger
}

func (s *staticEvaluator) EvalFlag(ctx context.Context, flagKey string) (openfeature.BooleanEvaluationDetails, error) {
	result, err := s.client.BooleanValueDetails(ctx, flagKey, false, openfeature.TransactionContext(ctx))
	if err != nil {
		return openfeature.BooleanEvaluationDetails{}, fmt.Errorf("failed to evaluate flag %s: %w", flagKey, err)
	}

	return result, nil
}

func (s *staticEvaluator) EvalAllFlags(ctx context.Context) (OFREPBulkResponse, error) {
	flags, err := s.provider.ListFlags()
	if err != nil {
		return OFREPBulkResponse{}, fmt.Errorf("static provider failed to list all flags: %w", err)
	}

	allFlags := make([]OFREPFlag, 0, len(flags))
	for _, flagKey := range flags {
		result, err := s.client.BooleanValueDetails(ctx, flagKey, false, openfeature.TransactionContext(ctx))
		if err != nil {
			s.log.Error("failed to evaluate flag during bulk evaluation", "flagKey", flagKey, "error", err)
			continue
		}

		allFlags = append(allFlags, OFREPFlag{
			Key:          flagKey,
			Value:        result.Value,
			Reason:       "static provider evaluation result",
			Variant:      result.Variant,
			ErrorCode:    string(result.ErrorCode),
			ErrorDetails: result.ErrorMessage,
		})
	}

	return OFREPBulkResponse{Flags: allFlags}, nil
}

// OFREPBulkResponse represents the response for bulk flag evaluation
type OFREPBulkResponse struct {
	Flags    []OFREPFlag    `json:"flags"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

// OFREPFlag represents a single flag in the bulk response
type OFREPFlag struct {
	Key          string         `json:"key"`
	Value        bool           `json:"value"`
	Reason       string         `json:"reason"`
	Variant      string         `json:"variant,omitempty"`
	Metadata     map[string]any `json:"metadata,omitempty"`
	ErrorCode    string         `json:"errorCode,omitempty"`
	ErrorDetails string         `json:"errorDetails,omitempty"`
}
