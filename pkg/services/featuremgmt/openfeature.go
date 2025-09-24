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

func InitOpenFeatureWithCfg(cfg *setting.Cfg) error {
	confFlags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
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

	err = initOpenFeature(cfg.OpenFeature.ProviderType, cfg.OpenFeature.URL, confFlags, httpcli)
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
	httpClient *http.Client,
) error {
	p, err := createProvider(providerType, u, staticFlags, httpClient)
	if err != nil {
		return err
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
	httpClient *http.Client,
) (openfeature.FeatureProvider, error) {
	if providerType != setting.GOFFProviderType {
		return newStaticProvider(staticFlags)
	}

	if u.String() == "" {
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
