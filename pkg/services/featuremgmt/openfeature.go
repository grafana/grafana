package featuremgmt

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/open-feature/go-sdk/openfeature"
)

type OpenFeatureService struct {
	cfg      *setting.Cfg
	provider openfeature.FeatureProvider
	Client   openfeature.IClient
}

func ProvideOpenFeatureService(cfg *setting.Cfg) (*OpenFeatureService, error) {
	var provider openfeature.FeatureProvider
	var err error
	if cfg.OpenFeature.ProviderType == setting.GOFFProviderType {
		provider, err = newGOFFProvider(cfg.OpenFeature.URL)
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
		provider: provider,
		Client:   client,
	}, nil
}

func (s *OpenFeatureService) EvalFlagWithStaticProvider(ctx context.Context, flagKey string) (openfeature.BooleanEvaluationDetails, error) {
	if s.cfg.OpenFeature.ProviderType == setting.GOFFProviderType {
		return openfeature.BooleanEvaluationDetails{}, fmt.Errorf("request must be sent to open feature service for %s provider", setting.GOFFProviderType)
	}

	result, err := s.Client.BooleanValueDetails(ctx, flagKey, false, openfeature.TransactionContext(ctx))
	if err != nil {
		return openfeature.BooleanEvaluationDetails{}, fmt.Errorf("failed to evaluate flag %s: %w", flagKey, err)
	}

	return result, nil
}

func (s *OpenFeatureService) EvalAllFlagsWithStaticProvider(ctx context.Context) (AllFlagsGOFFResp, error) {
	if s.cfg.OpenFeature.ProviderType == setting.GOFFProviderType {
		return AllFlagsGOFFResp{}, fmt.Errorf("request must be sent to open feature service for %s provider", setting.GOFFProviderType)
	}

	// TODO: implement this

	return AllFlagsGOFFResp{}, nil
}

type AllFlagsGOFFResp struct {
	Flags map[string]*FlagGOFF `json:"flags"`
}

type FlagGOFF struct {
	VariationType string `json:"variationType"`
	Timestamp     int    `json:"timestamp"`
	TrackEvents   bool   `json:"trackEvents"`
	Value         bool   `json:"value"`
}
