package featuremgmt

import (
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
)

// inMemoryBulkProvider is a wrapper around memprovider.InMemoryProvider that
// also allows for bulk evaluation of flags, necessary to proxy OFREP requests.
type inMemoryBulkProvider struct {
	memprovider.InMemoryProvider
	flags map[string]memprovider.InMemoryFlag
}

func newInMemoryBulkProvider(flags map[string]memprovider.InMemoryFlag) *inMemoryBulkProvider {
	return &inMemoryBulkProvider{
		InMemoryProvider: memprovider.NewInMemoryProvider(flags),
		flags:            flags,
	}
}

// ListFlags returns a list of all flags registered with the provider.
func (p *inMemoryBulkProvider) ListFlags() ([]string, error) {
	keys := make([]string, 0, len(p.flags))
	for key := range p.flags {
		keys = append(keys, key)
	}
	return keys, nil
}

func newStaticProvider(confFlags map[string]bool) (openfeature.FeatureProvider, error) {
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

	return newInMemoryBulkProvider(flags), nil
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
