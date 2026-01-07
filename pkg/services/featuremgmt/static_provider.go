package featuremgmt

import (
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/setting"
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

func newStaticProvider(confFlags map[string]memprovider.InMemoryFlag, standardFlags []FeatureFlag) (openfeature.FeatureProvider, error) {
	flags := make(map[string]memprovider.InMemoryFlag, len(standardFlags))
	index := make(map[string]FeatureFlag, len(standardFlags))
	// Add standard flags
	for _, flag := range standardFlags {
		inMemFlag := setting.ParseFlag(flag.Name, flag.Expression)

		flags[flag.Name] = inMemFlag
		index[flag.Name] = flag
	}

	// Add flags from config.ini file
	for name, flag := range confFlags {
		standard, exists := flags[flag.Key]

		// Fail fast if a flag is declared with a mismatched type
		standardValue, _ := setting.GetDefaultValue(standard)
		flagValue, _ := setting.GetDefaultValue(flag)

		if exists && reflect.TypeOf(standardValue) != reflect.TypeOf(flagValue) {
			return nil, fmt.Errorf("type mismatch for flag '%s' detected", flag.Key)
		}

		flags[name] = flag
	}

	return newInMemoryBulkProvider(flags), nil
}
