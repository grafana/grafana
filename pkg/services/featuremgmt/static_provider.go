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
		state := memprovider.Disabled
		if value {
			state = memprovider.Enabled
		}
		flags[key] = memprovider.InMemoryFlag{
			Key:            key,
			State:          state,
			DefaultVariant: "false",
			Variants: map[string]interface{}{
				"true":  true,
				"false": false,
			},
		}
	}

	return memprovider.NewInMemoryProvider(flags), nil
}
