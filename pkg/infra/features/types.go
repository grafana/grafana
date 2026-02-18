package features

import (
	"net/http"
	"net/url"
)

// OpenFeatureProviderType specifies the type of OpenFeature provider to use
type OpenFeatureProviderType string

const (
	// FeaturesServiceProviderType uses Feature Flag Service with token exchange
	FeaturesServiceProviderType OpenFeatureProviderType = "features-service"
	// OFREPProviderType uses an OFREP-compatible provider
	OFREPProviderType OpenFeatureProviderType = "ofrep"
)

// OpenFeatureConfig holds configuration for initializing OpenFeature with remote providers
type OpenFeatureConfig struct {
	// ProviderType is either "features-service" or "ofrep"
	ProviderType OpenFeatureProviderType
	// URL is the remote provider's URL (required)
	URL *url.URL
	// HTTPClient is a pre-configured HTTP client (required for authenticated providers)
	HTTPClient *http.Client
	// TargetingKey is used for evaluation context
	TargetingKey string
	// ContextAttrs are additional attributes for evaluation context
	ContextAttrs map[string]any
}
