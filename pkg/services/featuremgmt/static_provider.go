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

	flags := make(map[string]memprovider.InMemoryFlag, len(standardFeatureFlags))

	// Add flags from config.ini file
	for name, value := range confFlags {
		flags[name] = createInMemoryFlag(name, value)
	}

	// Add standard flags
	for _, flag := range standardFeatureFlags {
		if _, exists := flags[flag.Name]; !exists {
			enabled := flag.Expression == "true"
			flags[flag.Name] = createInMemoryFlag(flag.Name, enabled)
		}
	}

	return memprovider.NewInMemoryProvider(flags), nil
}

func createInMemoryFlag(name string, enabled bool) memprovider.InMemoryFlag {
	variant := "disabled"
	if enabled {
		variant = "enabled"
	}

	return memprovider.InMemoryFlag{
		Key:            name,
		DefaultVariant: variant,
		Variants: map[string]interface{}{
			"enabled":  true,
			"disabled": false,
		},
	}
}
