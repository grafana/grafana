package featuremgmt

import (
	"fmt"
	"net/url"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/clientauth/middleware"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/open-feature/go-sdk/openfeature"
)

const (
	featuresProviderAudience = "features.grafana.app"
)

func InitOpenFeatureWithCfg(
	cfg *setting.Cfg,
	httpClientProvider *sdkhttpclient.Provider,
	exchangeMiddleware *middleware.TokenExchangeMiddleware,
) error {
	confFlags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return fmt.Errorf("failed to read feature flags from config: %w", err)
	}

	err = initOpenFeature(cfg.OpenFeature.ProviderType, cfg.OpenFeature.URL, confFlags, httpClientProvider, exchangeMiddleware)
	if err != nil {
		return fmt.Errorf("failed to initialize OpenFeature: %w", err)
	}
	openfeature.SetEvaluationContext(openfeature.NewEvaluationContext(cfg.OpenFeature.TargetingKey, cfg.OpenFeature.ContextAttrs))

	return nil
}

func initOpenFeature(
	providerType string,
	u *url.URL,
	staticFlags map[string]bool,
	httpClientProvider *sdkhttpclient.Provider,
	exchangeMiddleware *middleware.TokenExchangeMiddleware,
) error {
	p, err := createProvider(providerType, u, staticFlags, httpClientProvider, exchangeMiddleware)
	if err != nil {
		return fmt.Errorf("failed to create feature provider: type %s, %w", providerType, err)
	}

	if err := openfeature.SetProviderAndWait(p); err != nil {
		return fmt.Errorf("failed to set global feature provider: %s, %w", providerType, err)
	}

	return nil
}

func createProvider(
	providerType string,
	u *url.URL,
	staticFlags map[string]bool,
	httpClientProvider *sdkhttpclient.Provider,
	exchangeMiddleware *middleware.TokenExchangeMiddleware,
) (openfeature.FeatureProvider, error) {
	if providerType != setting.GOFFProviderType {
		return newStaticProvider(staticFlags)
	}

	if u.String() == "" {
		return nil, fmt.Errorf("feature provider url is required for GOFFProviderType")
	}

	httpcli, err := httpClientProvider.New(sdkhttpclient.Options{
		// TODO: remove this before merge
		TLS: &sdkhttpclient.TLSOptions{InsecureSkipVerify: true},
		Timeouts: &sdkhttpclient.TimeoutOptions{
			Timeout: 10 * time.Second,
		},
		Middlewares: []sdkhttpclient.Middleware{
			exchangeMiddleware.New([]string{featuresProviderAudience}),
		},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to create http client for openfeature: %w", err)
	}

	return newGOFFProvider(u.String(), httpcli)
}
