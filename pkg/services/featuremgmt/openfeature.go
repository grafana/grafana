package featuremgmt

import (
	"fmt"
	"net/url"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/clientauth/middleware"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type OpenFeatureService struct {
	log                      log.Logger
	provider                 openfeature.FeatureProvider
	stackID                  string
	Client                   openfeature.IClient
	httpClientProvider       *sdkhttpclient.Provider
	signerMiddlewareProvider *middleware.CloudAccessPolicyTokenSignerMiddlewareProvider
}

const (
	cloudFeaturesProviderAudience = "features.grafana.app"
)

// ProvideOpenFeatureService is used for wiring dependencies in single tenant grafana
func ProvideOpenFeatureService(cfg *setting.Cfg, httpClientProvider *sdkhttpclient.Provider, signerMiddlewareProvider *middleware.CloudAccessPolicyTokenSignerMiddlewareProvider) (*OpenFeatureService, error) {
	confFlags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return nil, fmt.Errorf("failed to read feature toggles from config: %w", err)
	}

	openfeature.SetEvaluationContext(openfeature.NewEvaluationContext(cfg.OpenFeature.TargetingKey, cfg.OpenFeature.ContextAttrs))
	return newOpenFeatureService(cfg.OpenFeature.ProviderType, cfg.OpenFeature.URL, confFlags, httpClientProvider, signerMiddlewareProvider)
}

// TODO: might need to be public, so other MT services could set up open feature client
// stackID may be empty for non-cloud use-case
func newOpenFeatureService(pType string, u *url.URL, staticFlags map[string]bool, httpClientProvider *sdkhttpclient.Provider, signerMiddlewareProvider *middleware.CloudAccessPolicyTokenSignerMiddlewareProvider) (*OpenFeatureService, error) {
	p, err := createProvider(pType, u, staticFlags, httpClientProvider, signerMiddlewareProvider)
	if err != nil {
		return nil, fmt.Errorf("failed to create feature provider: type %s, %w", pType, err)
	}

	if err := openfeature.SetProviderAndWait(p); err != nil {
		return nil, fmt.Errorf("failed to set global feature provider: %s, %w", pType, err)
	}

	client := openfeature.NewClient("grafana-openfeature-client")
	return &OpenFeatureService{
		log:                      log.New("openfeatureservice"),
		provider:                 p,
		Client:                   client,
		httpClientProvider:       httpClientProvider,
		signerMiddlewareProvider: signerMiddlewareProvider,
	}, nil
}

func createProvider(providerType string, u *url.URL, staticFlags map[string]bool, httpClientProvider *sdkhttpclient.Provider, signerMiddlewareProvider *middleware.CloudAccessPolicyTokenSignerMiddlewareProvider) (openfeature.FeatureProvider, error) {
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
			signerMiddlewareProvider.New([]string{cloudFeaturesProviderAudience}),
		},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to create http client for openfeature: %w", err)
	}

	return newGOFFProvider(u.String(), httpcli)
}

func createClient(provider openfeature.FeatureProvider) (openfeature.IClient, error) {
	if err := openfeature.SetProviderAndWait(provider); err != nil {
		return nil, fmt.Errorf("failed to set global feature provider: %w", err)
	}

	client := openfeature.NewClient("grafana-openfeature-client")
	return client, nil
}
