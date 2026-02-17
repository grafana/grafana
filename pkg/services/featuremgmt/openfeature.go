package featuremgmt

import (
	"fmt"
	"maps"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/features"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
)

// CreateStaticProviderWithStandardFlags creates a static provider with both
// Grafana's standard flags and user-provided flags merged together.
// This is useful for tests and internal Grafana code that needs static providers
// with Grafana's feature flags.
func CreateStaticProviderWithStandardFlags(userFlags map[string]memprovider.InMemoryFlag) (openfeature.FeatureProvider, error) {
	flags := make(map[string]memprovider.InMemoryFlag, len(standardFeatureFlags))

	// Parse and add standard flags
	for _, flag := range standardFeatureFlags {
		inMemFlag, err := setting.ParseFlag(flag.Name, flag.Expression)
		if err != nil {
			return nil, fmt.Errorf("failed to parse flag %s: %w", flag.Name, err)
		}
		flags[flag.Name] = inMemFlag
	}

	// Merge user flags (they override standard flags)
	maps.Copy(flags, userFlags)

	return newInMemoryBulkProvider(flags), nil
}

// createHTTPClientForProvider creates an HTTP client based on provider type
func createHTTPClientForProvider(cfg *setting.Cfg, providerType features.OpenFeatureProviderType) (*http.Client, error) {
	if providerType == features.FeaturesServiceProviderType {
		tokenExchanger, namespace, err := getTokenExchangeConfig(cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to get token exchange config: %w", err)
		}

		return features.CreateHTTPClientWithTokenExchange(
			tokenExchanger,
			namespace,
			[]string{features.FeaturesProviderAudience},
			features.HTTPClientOptions{
				InsecureSkipVerify: true,
			},
		)
	}

	return features.CreateHTTPClient(
		features.HTTPClientOptions{
			InsecureSkipVerify: true,
		},
	)
}

// InitOpenFeatureWithCfg initializes OpenFeature from setting.Cfg.
// This is the main entry point for Grafana production code to initialize OpenFeature.
func InitOpenFeatureWithCfg(cfg *setting.Cfg) error {
	confFlags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return fmt.Errorf("failed to read feature flags from config: %w", err)
	}

	contextAttrs := make(map[string]any)
	for k, v := range cfg.OpenFeature.ContextAttrs {
		contextAttrs[k] = v
	}

	// Handle remote providers
	if cfg.OpenFeature.ProviderType == features.OFREPProviderType || cfg.OpenFeature.ProviderType == features.FeaturesServiceProviderType {
		httpcli, err := createHTTPClientForProvider(cfg, cfg.OpenFeature.ProviderType)
		if err != nil {
			return err
		}

		return features.InitOpenFeature(features.OpenFeatureConfig{
			ProviderType: features.OpenFeatureProviderType(cfg.OpenFeature.ProviderType),
			URL:          cfg.OpenFeature.URL,
			HTTPClient:   httpcli,
			TargetingKey: cfg.OpenFeature.TargetingKey,
			ContextAttrs: contextAttrs,
		})
	}

	// Handle static provider
	provider, err := CreateStaticProviderWithStandardFlags(confFlags)
	if err != nil {
		return err
	}

	if err := openfeature.SetProviderAndWait(provider); err != nil {
		return fmt.Errorf("failed to set static feature provider: %w", err)
	}

	openfeature.SetEvaluationContext(openfeature.NewEvaluationContext(cfg.OpenFeature.TargetingKey, contextAttrs))
	return nil
}
