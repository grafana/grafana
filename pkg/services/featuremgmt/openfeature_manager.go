package featuremgmt

import (
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
)

const (
	staticProviderType = "static"
	goffProviderType   = "goff"

	configSectionName = "feature_toggles.openfeature"
)

type OpenFeatureManager struct {
	provider openfeature.FeatureProvider
	Client   openfeature.IClient
}

func ProvideOpenFeatureManager(cfg *setting.Cfg) (*OpenFeatureManager, error) {
	section := cfg.SectionWithEnvOverrides(configSectionName)

	provType := section.Key("provider").MustString(staticProviderType)
	url := section.Key("url").MustString("")
	key := section.Key("instance_slug").MustString("")

	var provider openfeature.FeatureProvider
	var err error
	if provType == goffProviderType {
		provider, err = newGOFFProvider(url)
	} else {
		provider, err = newStaticProvider(cfg)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create %s feature provider: %w", provType, err)
	}

	if err := openfeature.SetProviderAndWait(provider); err != nil {
		return nil, fmt.Errorf("failed to set global %s feature provider: %w", provType, err)
	}

	// TODO: Is targeting key needed here?
	// TODO: idk whether slug makes any sense for on-prem grafana, or should it be removed?
	openfeature.SetEvaluationContext(openfeature.NewEvaluationContext(
		key,
		map[string]interface{}{
			"slug":            key,
			"grafana_version": cfg.BuildVersion,
		}))

	client := openfeature.NewClient("grafana-openfeature-client")

	return &OpenFeatureManager{
		provider: provider,
		Client:   client,
	}, nil
}
