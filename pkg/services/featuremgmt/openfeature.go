package featuremgmt

import (
	"fmt"
	"net/url"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/open-feature/go-sdk/openfeature"
)

func InitOpenFeatureWithCfg(cfg *setting.Cfg) error {
	confFlags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return fmt.Errorf("failed to read feature flags from config: %w", err)
	}

	err = initOpenFeature(cfg.OpenFeature.ProviderType, cfg.OpenFeature.URL, confFlags)
	if err != nil {
		return fmt.Errorf("failed to initialize OpenFeature: %w", err)
	}
	openfeature.SetEvaluationContext(openfeature.NewEvaluationContext(cfg.OpenFeature.TargetingKey, cfg.OpenFeature.ContextAttrs))

	return nil
}

func initOpenFeature(providerType string, u *url.URL, staticFlags map[string]bool) error {
	p, err := createProvider(providerType, u, staticFlags)
	if err != nil {
		return fmt.Errorf("failed to create feature provider: type %s, %w", providerType, err)
	}

	if err := openfeature.SetProviderAndWait(p); err != nil {
		return fmt.Errorf("failed to set global feature provider: %s, %w", providerType, err)
	}

	return nil
}

func createProvider(providerType string, u *url.URL, staticFlags map[string]bool) (openfeature.FeatureProvider, error) {
	if providerType != setting.GOFFProviderType {
		return newStaticProvider(staticFlags)
	}

	if u.String() == "" {
		return nil, fmt.Errorf("feature provider url is required for GOFFProviderType")
	}

	return newGOFFProvider(u.String())
}
