package featuremgmt

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/features"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
)

// InitOpenFeatureWithCfg initializes OpenFeature from setting.Cfg.
// This is the main entry point for Grafana production code to initialize OpenFeature.
func InitOpenFeatureWithCfg(cfg *setting.Cfg) error {
	// Phase 1: Read configuration
	confFlags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return fmt.Errorf("failed to read feature flags from config: %w", err)
	}

	contextAttrs := buildContextAttrs(cfg)

	// Phase 2: Create provider based on type
	var provider openfeature.FeatureProvider
	switch cfg.OpenFeature.ProviderType {
	case features.FeaturesServiceProviderType, features.OFREPProviderType:
		provider, err = createRemoteProvider(cfg)
	default: // Static provider
		provider, err = CreateStaticProviderWithStandardFlags(confFlags)
	}
	if err != nil {
		return err
	}

	// Phase 3: Initialize OpenFeature
	if err := openfeature.SetProviderAndWait(provider); err != nil {
		return fmt.Errorf("failed to set feature provider: %w", err)
	}

	openfeature.SetEvaluationContext(
		openfeature.NewEvaluationContext(cfg.OpenFeature.TargetingKey, contextAttrs),
	)
	return nil
}

// CreateStaticProviderWithStandardFlags creates a static provider with both
// Grafana's standard flags and user-provided flags merged together.
// This is useful for tests and internal Grafana code that needs static providers.
func CreateStaticProviderWithStandardFlags(userFlags map[string]memprovider.InMemoryFlag) (openfeature.FeatureProvider, error) {
	return newStaticProvider(userFlags, standardFeatureFlags)
}

// buildContextAttrs extracts context attributes from Grafana configuration.
func buildContextAttrs(cfg *setting.Cfg) map[string]any {
	contextAttrs := make(map[string]any)
	for k, v := range cfg.OpenFeature.ContextAttrs {
		contextAttrs[k] = v
	}
	return contextAttrs
}

// createRemoteProvider creates a remote OpenFeature provider (OFREP or FeaturesService).
func createRemoteProvider(cfg *setting.Cfg) (openfeature.FeatureProvider, error) {
	// Build authentication config if needed
	var authConfig *features.TokenExchangeConfig
	if cfg.OpenFeature.ProviderType == features.FeaturesServiceProviderType {
		tokenExchanger, namespace, err := setupTokenExchange(cfg)
		if err != nil {
			return nil, fmt.Errorf("failed to setup token exchange: %w", err)
		}

		authConfig = &features.TokenExchangeConfig{
			TokenExchanger: tokenExchanger,
			Namespace:      namespace,
			Audiences:      []string{features.FeaturesProviderAudience},
		}
	}

	// Create HTTP client
	httpcli, err := features.CreateHTTPClientForProvider(
		cfg.OpenFeature.ProviderType,
		authConfig,
		features.HTTPClientOptions{InsecureSkipVerify: true},
	)
	if err != nil {
		return nil, err
	}

	// Both FeaturesServiceProviderType and OFREPProviderType use the OFREP provider.
	// We previously used the go-feature-flag SDK provider for FeaturesServiceProviderType,
	// but go-feature-flag's relay proxy implements OFREP.
	return features.NewOFREPProvider(cfg.OpenFeature.URL.String(), httpcli)
}
