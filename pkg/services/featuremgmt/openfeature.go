package featuremgmt

import (
	"fmt"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/open-feature/go-sdk/openfeature"
)

type OpenFeatureService struct {
	log      log.Logger
	provider openfeature.FeatureProvider
	Client   openfeature.IClient
}

// ProvideOpenFeatureService is used for wiring dependencies in single tenant grafana
func ProvideOpenFeatureService(cfg *setting.Cfg) (*OpenFeatureService, error) {
	confFlags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return nil, fmt.Errorf("failed to read feature toggles from config: %w", err)
	}

	openfeature.SetEvaluationContext(openfeature.NewEvaluationContext(cfg.OpenFeature.TargetingKey, cfg.OpenFeature.ContextAttrs))
	return newOpenFeatureService(cfg.OpenFeature.ProviderType, cfg.OpenFeature.URL, confFlags)
}

// TODO: might need to be public, so other MT services could set up open feature client
func newOpenFeatureService(pType string, u *url.URL, staticFlags map[string]bool) (*OpenFeatureService, error) {
	p, err := createProvider(pType, u, staticFlags)
	if err != nil {
		return nil, fmt.Errorf("failed to create feature provider: type %s, %w", pType, err)
	}

	if err := openfeature.SetProviderAndWait(p); err != nil {
		return nil, fmt.Errorf("failed to set global feature provider: %s, %w", pType, err)
	}

	client := openfeature.NewClient("grafana-openfeature-client")
	return &OpenFeatureService{
		log:      log.New("openfeatureservice"),
		provider: p,
		Client:   client,
	}, nil
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

func createClient(provider openfeature.FeatureProvider) (openfeature.IClient, error) {
	if err := openfeature.SetProviderAndWait(provider); err != nil {
		return nil, fmt.Errorf("failed to set global feature provider: %w", err)
	}

	client := openfeature.NewClient("grafana-openfeature-client")
	return client, nil
}
