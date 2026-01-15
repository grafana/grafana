package featuremgmt

import (
	"fmt"
	"maps"

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

func newStaticProvider(confFlags map[string]memprovider.InMemoryFlag, standardFlags []FeatureFlag) (openfeature.FeatureProvider, error) {
	flags := make(map[string]memprovider.InMemoryFlag, len(standardFlags))

	// Parse and add standard flags
	for _, flag := range standardFlags {
		// Backwards support for Standard Flags with no Expressions
		expression := flag.Expression
		if flag.Expression == "" {
			expression = "false"
		}

		inMemFlag, err := setting.ParseFlag(flag.Name, expression)
		if err != nil {
			return nil, fmt.Errorf("failed to parse flag %s: %w", flag.Name, err)
		}

		flags[flag.Name] = inMemFlag
	}

	// Add flags from config.ini file
	maps.Copy(flags, confFlags)

	return newInMemoryBulkProvider(flags), nil
}
