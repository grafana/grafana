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

func (s *OpenFeatureService) EvalAllFlagsWithStaticProvider(ctx context.Context) (AllFlagsGOFFResp, error) {
	p, ok := s.provider.(*inMemoryBulkProvider)
	if !ok {
		return AllFlagsGOFFResp{}, fmt.Errorf("not a static provider, request must be sent to open feature service")
	}

	flags, err := p.ListFlags()
	if err != nil {
		return AllFlagsGOFFResp{}, fmt.Errorf("static provider failed to list all flags: %w", err)
	}

	allFlags := make(map[string]*FlagGOFF, len(flags))
	for _, flagKey := range flags {
		result, err := s.Client.BooleanValueDetails(ctx, flagKey, false, openfeature.TransactionContext(ctx))
		if err != nil {
			s.log.Error("failed to evaluate flag during bulk evaluation", "flagKey", flagKey, "error", err)
			continue
		}

		// TODO: see if this needs to be changed so the open feature client understands the response
		allFlags[flagKey] = &FlagGOFF{
			VariationType: "boolean",
			Value:         result.Value,
		}
	}

	return AllFlagsGOFFResp{
		Flags: allFlags,
	}, nil
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
