package featuremgmt

import (
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"

	"github.com/grafana/grafana/pkg/setting"
)

// inMemoryBulkProvider is a wrapper around memprovider.InMemoryProvider that
// also allows for bulk evaluation of flags, necessary to proxy OFREP requests.
type inMemoryBulkProvider struct {
	memprovider.InMemoryProvider
	flags map[string]memprovider.InMemoryFlag
}

func newInMemoryBulkProvider(typedFlags map[string]memprovider.InMemoryFlag) *inMemoryBulkProvider {
	// Convert TypedFlags to InMemoryFlags for the provider
	flags := make(map[string]memprovider.InMemoryFlag, len(typedFlags))
	for key, flag := range typedFlags {
		flags[key] = flag
	}

	return &inMemoryBulkProvider{
		InMemoryProvider: memprovider.NewInMemoryProvider(flags),
		flags:            typedFlags,
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

func newStaticProvider(confFlags map[string]memprovider.InMemoryFlag, standardFlags []FeatureFlag) (openfeature.FeatureProvider, error) {
	typedFlags := make(map[string]memprovider.InMemoryFlag, len(standardFlags)+len(confFlags))

	// Parse and add standard flags with type information
	for _, flag := range standardFlags {
		inMemFlag, err := setting.ParseFlag(flag.Name, flag.Expression)
		if err != nil {
			return nil, fmt.Errorf("failed to parse flag %s: %w", flag.Name, err)
		}

		typedFlags[flag.Name] = inMemFlag

	}

	// Add flags from config.ini file - already typed
	for name, typedFlag := range confFlags {
		typedFlags[name] = typedFlag
	}

	return newInMemoryBulkProvider(typedFlags), nil
}
