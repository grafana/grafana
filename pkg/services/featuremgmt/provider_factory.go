package featuremgmt

import (
	"fmt"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
)

func createProvider(providerType string, u *url.URL, staticFlags map[string]bool) (openfeature.FeatureProvider, error) {
	if providerType != setting.GOFFProviderType {
		return newStaticProvider(staticFlags)
	}

	if u.String() == "" {
		return nil, fmt.Errorf("feature provider url is required for GOFFProviderType")
	}

	return newGOFFProvider(u.String())
}

func createClient(provider openfeature.FeatureProvider) (openfeature.IClient, error) {
	if err := openfeature.SetProviderAndWait(provider); err != nil {
		return nil, fmt.Errorf("failed to set global feature provider: %w", err)
	}

	client := openfeature.NewClient("grafana-openfeature-client")
	return client, nil
}

// createStaticEvaluator evaluator that allows evaluating static flags from config.ini
func createStaticEvaluator(providerType string, u *url.URL, staticFlags map[string]bool) (StaticFlagEvaluator, error) {
	if providerType == setting.GOFFProviderType {
		return nil, fmt.Errorf("cannot create static evaluator for GOFF provider")
	}

	provider, err := createProvider(providerType, u, staticFlags)
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

// ProvideStaticEvaluator creates a static evaluator from configuration
// This can be used in wire dependency injection
func ProvideStaticEvaluator(cfg *setting.Cfg) (StaticFlagEvaluator, error) {
	confFlags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return nil, fmt.Errorf("failed to read feature toggles from config: %w", err)
	}

	return createStaticEvaluator(cfg.OpenFeature.ProviderType, cfg.OpenFeature.URL, confFlags)
}
