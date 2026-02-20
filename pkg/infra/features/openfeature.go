package features

import (
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
)

// InitOpenFeature initializes the global OpenFeature SDK with a remote provider.
// 1. Creates a provider with the provided URL and HTTP client
// 2. Sets it as the global OpenFeature provider
// 3. Configures the evaluation context with targeting key and attributes
func InitOpenFeature(config OpenFeatureConfig) error {
	// Validate remote provider configuration
	if config.URL == nil || config.URL.String() == "" {
		return fmt.Errorf("URL is required for remote providers")
	}

	// Create OFREP provider (works for both FeaturesServiceProviderType and OFREPProviderType)
	provider, err := NewOFREPProvider(config.URL.String(), config.HTTPClient)
	if err != nil {
		return fmt.Errorf("failed to create provider: %w", err)
	}

	// Set the provider globally and wait for it to be ready
	if err := openfeature.SetProviderAndWait(provider); err != nil {
		return fmt.Errorf("failed to set global feature provider: %s, %w", config.ProviderType, err)
	}

	// Set up evaluation context with targeting key and additional attributes
	contextAttrs := make(map[string]any)
	for k, v := range config.ContextAttrs {
		contextAttrs[k] = v
	}

	var evalCtx openfeature.EvaluationContext
	if config.TargetingKey != "" {
		evalCtx = openfeature.NewEvaluationContext(config.TargetingKey, contextAttrs)
	} else {
		evalCtx = openfeature.NewTargetlessEvaluationContext(contextAttrs)
	}
	openfeature.SetEvaluationContext(evalCtx)

	return nil
}
