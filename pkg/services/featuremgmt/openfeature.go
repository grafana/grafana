package featuremgmt

import (
	"context"
	"fmt"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/open-feature/go-sdk/openfeature"
)

type OpenFeatureService struct {
	log      log.Logger
	provider openfeature.FeatureProvider
	Client   openfeature.IClient
}

func provider(pType string, u *url.URL, staticFlags map[string]bool) (openfeature.FeatureProvider, error) {
	if pType != setting.GOFFProviderType {
		return newStaticProvider(staticFlags)
	}

	if u.String() == "" {
		return nil, fmt.Errorf("feature provider url is required for GOFFProviderType")
	}

	return newGOFFProvider(u.String())
}

func NewOpenFeatureService(pType string, u *url.URL, staticFlags map[string]bool) (*OpenFeatureService, error) {
	p, err := provider(pType, u, staticFlags)
	if err != nil {
		return nil, fmt.Errorf("failed to create feature provider: type %s, %w", pType, err)
	}

	if err := openfeature.SetProviderAndWait(p); err != nil {
		return nil, fmt.Errorf("failed to set global feature provider: %s, %w", pType, err)
	}

	client := openfeature.NewClient("grafana-openfeature-client")
	return &OpenFeatureService{
		log:      log.New("openfeatureservice"),
		provider: p,
		Client:   client,
	}, nil
}

// used for wiring dependencies in ST grafana
func ProvideOpenFeatureService(cfg *setting.Cfg) (*OpenFeatureService, error) {
	confFlags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return nil, fmt.Errorf("failed to read feature toggles from config: %w", err)
	}

	openfeature.SetEvaluationContext(openfeature.NewEvaluationContext(cfg.OpenFeature.TargetingKey, cfg.OpenFeature.ContextAttrs))
	return NewOpenFeatureService(cfg.OpenFeature.ProviderType, cfg.OpenFeature.URL, confFlags)
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
