package featuremgmt

import (
	"fmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
)

func newStaticProvider(cfg *setting.Cfg) (openfeature.FeatureProvider, error) {
	confFlags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return nil, fmt.Errorf("failed to read feature toggles from config: %w", err)
	}

	flags := make(map[string]memprovider.InMemoryFlag)
	for key, value := range confFlags {
		variant := "disabled"
		if value {
			variant = "enabled"
		}

		flags[key] = memprovider.InMemoryFlag{
			Key:            key,
			DefaultVariant: variant,
			Variants: map[string]interface{}{
				"enabled":  true,
				"disabled": false,
			},
		}
	}

	return memprovider.NewInMemoryProvider(flags), nil
}
