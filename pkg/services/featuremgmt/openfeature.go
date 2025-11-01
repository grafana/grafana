package featuremgmt

import (
	"fmt"
	"net/http"
	"net/url"
	"time"

	clientauthmiddleware "github.com/grafana/grafana/pkg/clientauth/middleware"
	"github.com/grafana/grafana/pkg/setting"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/open-feature/go-sdk/openfeature"
)

const (
	featuresProviderAudience = "features.grafana.app"
)

// OpenFeatureConfig holds configuration for initializing OpenFeature
type OpenFeatureConfig struct {
	// ProviderType is either "static" or "goff"
	ProviderType string
	// URL is the GOFF service URL (required for GOFF provider)
	URL *url.URL
	// HTTPClient is a pre-configured HTTP client (optional, used for GOFF provider)
	HTTPClient *http.Client
	// TypedFlags are the feature flags to use with static provider
	StaticFlags map[string]setting.TypedFeatureFlag
	// TargetingKey is used for evaluation context
	TargetingKey string
	// ContextAttrs are additional attributes for evaluation context
	ContextAttrs map[string]any
}

// InitOpenFeature initializes OpenFeature with the provided configuration
func InitOpenFeature(config OpenFeatureConfig) error {
	// For GOFF provider, ensure we have a URL
	if config.ProviderType == setting.GOFFProviderType && (config.URL == nil || config.URL.String() == "") {
		return fmt.Errorf("URL is required for GOFF provider")
	}

	p, err := createProvider(config.ProviderType, config.URL, config.StaticFlags, config.HTTPClient)
	if err != nil {
		return err
	}

	if err = openfeature.SetProviderAndWait(p); err != nil {
		return fmt.Errorf("failed to set global feature provider: %s, %w", config.ProviderType, err)
	}

	contextAttrs := make(map[string]any)
	for k, v := range config.ContextAttrs {
		contextAttrs[k] = v
	}
	openfeature.SetEvaluationContext(openfeature.NewEvaluationContext(config.TargetingKey, contextAttrs))

	return nil
}

// InitOpenFeatureWithCfg initializes OpenFeature from setting.Cfg
func InitOpenFeatureWithCfg(cfg *setting.Cfg) error {
	// Read typed flags from config
	confFlags, err := setting.ReadTypedFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return fmt.Errorf("failed to read feature flags from config: %w", err)
	}

	var httpcli *http.Client
	if cfg.OpenFeature.ProviderType == setting.GOFFProviderType {
		m, err := clientauthmiddleware.NewTokenExchangeMiddleware(cfg)
		if err != nil {
			return fmt.Errorf("failed to create token exchange middleware: %w", err)
		}

		httpcli, err = goffHTTPClient(m)
		if err != nil {
			return err
		}
	}

	contextAttrs := make(map[string]any)
	for k, v := range cfg.OpenFeature.ContextAttrs {
		contextAttrs[k] = v
	}

	return InitOpenFeature(OpenFeatureConfig{
		ProviderType: cfg.OpenFeature.ProviderType,
		URL:          cfg.OpenFeature.URL,
		HTTPClient:   httpcli,
		StaticFlags:  confFlags,
		TargetingKey: cfg.OpenFeature.TargetingKey,
		ContextAttrs: contextAttrs,
	})
}

func createProvider(
	providerType string,
	u *url.URL,
	staticFlags map[string]setting.TypedFeatureFlag,
	httpClient *http.Client,
) (openfeature.FeatureProvider, error) {
	if providerType != setting.GOFFProviderType {
		return newStaticProvider(staticFlags)
	}

	if u == nil || u.String() == "" {
		return nil, fmt.Errorf("feature provider url is required for GOFFProviderType")
	}

	return newGOFFProvider(u.String(), httpClient)
}

func goffHTTPClient(m *clientauthmiddleware.TokenExchangeMiddleware) (*http.Client, error) {
	httpcli, err := sdkhttpclient.NewProvider().New(sdkhttpclient.Options{
		TLS: &sdkhttpclient.TLSOptions{InsecureSkipVerify: true},
		Timeouts: &sdkhttpclient.TimeoutOptions{
			Timeout: 10 * time.Second,
		},
		Middlewares: []sdkhttpclient.Middleware{
			m.New([]string{featuresProviderAudience}),
		},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to create http client for openfeature: %w", err)
	}

	return httpcli, nil
}
