package featuremgmt

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/open-feature/go-sdk/openfeature"
)

type OpenFeatureService struct {
	cfg      *setting.Cfg
	log      log.Logger
	provider openfeature.FeatureProvider
	Client   openfeature.IClient
}

func ProvideOpenFeatureService(cfg *setting.Cfg) (*OpenFeatureService, error) {
	var provider openfeature.FeatureProvider
	var err error
	if cfg.OpenFeature.ProviderType == setting.GOFFProviderType {
		if cfg.OpenFeature.URL == nil {
			return nil, fmt.Errorf("feature provider url is required for GOFFProviderType")
		}

		provider, err = newGOFFProvider(cfg.OpenFeature.URL.String())
	} else {
		provider, err = newStaticProvider(cfg)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create %s feature provider: %w", cfg.OpenFeature.ProviderType, err)
	}

	if err := openfeature.SetProviderAndWait(provider); err != nil {
		return nil, fmt.Errorf("failed to set global %s feature provider: %w", cfg.OpenFeature.ProviderType, err)
	}

	openfeature.SetEvaluationContext(openfeature.NewEvaluationContext(cfg.OpenFeature.TargetingKey, cfg.OpenFeature.ContextAttrs))

	client := openfeature.NewClient("grafana-openfeature-client")
	return &OpenFeatureService{
		cfg:      cfg,
		log:      log.New("openfeatureservice"),
		provider: provider,
		Client:   client,
	}, nil
}

func (s *OpenFeatureService) EvalFlagWithStaticProvider(ctx context.Context, flagKey string) (openfeature.BooleanEvaluationDetails, error) {
	_, ok := s.provider.(*inMemoryBulkProvider)
	if !ok {
		return openfeature.BooleanEvaluationDetails{}, fmt.Errorf("not a static provider, request must be sent to open feature service")
	}

	result, err := s.Client.BooleanValueDetails(ctx, flagKey, false, openfeature.TransactionContext(ctx))
	if err != nil {
		return openfeature.BooleanEvaluationDetails{}, fmt.Errorf("failed to evaluate flag %s: %w", flagKey, err)
	}

	return result, nil
}

func (s *OpenFeatureService) EvalAllFlagsWithStaticProvider(ctx context.Context) (OFREPBulkResponse, error) {
	p, ok := s.provider.(*inMemoryBulkProvider)
	if !ok {
		return OFREPBulkResponse{}, fmt.Errorf("not a static provider, request must be sent to open feature service")
	}

	flags, err := p.ListFlags()
	if err != nil {
		return OFREPBulkResponse{}, fmt.Errorf("static provider failed to list all flags: %w", err)
	}

	allFlags := make([]OFREPFlag, 0, len(flags))
	for _, flagKey := range flags {
		result, err := s.Client.BooleanValueDetails(ctx, flagKey, false, openfeature.TransactionContext(ctx))
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

// Bulk evaluation response
type OFREPBulkResponse struct {
	Flags    []OFREPFlag    `json:"flags"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

type OFREPFlag struct {
	Key          string         `json:"key"`
	Value        bool           `json:"value"`
	Reason       string         `json:"reason"`
	Variant      string         `json:"variant,omitempty"`
	Metadata     map[string]any `json:"metadata,omitempty"`
	ErrorCode    string         `json:"errorCode,omitempty"`
	ErrorDetails string         `json:"errorDetails,omitempty"`
}
