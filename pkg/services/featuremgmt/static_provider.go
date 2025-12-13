package featuremgmt

import (
	"encoding/json"
	"fmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"strconv"
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

func newStaticProvider(confFlags map[string]setting.FeatureToggle, standardFlags []FeatureFlag) (openfeature.FeatureProvider, error) {
	flags := make(map[string]memprovider.InMemoryFlag, len(standardFlags))
	index := make(map[string]FeatureFlag, len(standardFlags))
	// Add standard flags
	for _, flag := range standardFlags {
		inMemFlag, err := createTypedFlag(flag)
		if err != nil {
			return nil, err
		}

		flags[flag.Name] = inMemFlag
		index[flag.Name] = flag
	}

	// Add flags from config.ini file
	for name, flag := range confFlags {
		standard, exists := index[flag.Name]

		// Fail fast if a flag is declared with a mismatched type
		if exists && standard.Type.String() != string(flag.Type) {
			return nil, fmt.Errorf("type mismatch for flag '%s' detected", flag.Name)
		}

		flags[name] = createInMemoryFlag(flag)
	}

	return newInMemoryBulkProvider(flags), nil
}

func createInMemoryFlag(flag setting.FeatureToggle) memprovider.InMemoryFlag {
	variant := "default"

	return memprovider.InMemoryFlag{
		Key:            flag.Name,
		DefaultVariant: variant,
		Variants: map[string]any{
			variant: flag.Value,
		},
	}
}

func createTypedFlag(flag FeatureFlag) (memprovider.InMemoryFlag, error) {
	defaultVariant := "default"

	var value any
	var err error
	switch flag.Type {
	case Boolean:
		value = flag.Expression == "true"
	case Integer:
		value, err = strconv.Atoi(flag.Expression)
	case Float:
		value, err = strconv.ParseFloat(flag.Expression, 64)
	case String:
		value = flag.Expression
	case Structure:
		err = json.Unmarshal([]byte(flag.Expression), &value)
	default:
		return memprovider.InMemoryFlag{}, fmt.Errorf("unsupported flag type %s", flag.Type)
	}

	if err != nil {
		return memprovider.InMemoryFlag{}, err
	}

	return memprovider.InMemoryFlag{
		Key:            flag.Name,
		DefaultVariant: defaultVariant,
		Variants: map[string]any{
			defaultVariant: value,
		},
	}, nil
}
