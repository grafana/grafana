package featuremgmt

import (
	"encoding/json"
	"fmt"
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

func newStaticProvider(confFlags map[string]bool, standardFlags []FeatureFlag) (openfeature.FeatureProvider, error) {
	flags := make(map[string]memprovider.InMemoryFlag, len(standardFlags))

	// Add flags from config.ini file
	for name, value := range confFlags {
		flags[name] = createInMemoryFlag(name, value)
	}

	// Add standard flags
	for _, flag := range standardFlags {
		_, exists := flags[flag.Name]

		if exists && flag.Type != Boolean {
			return nil, fmt.Errorf("flag %s already declared as boolean", flag.Name)
		}

		inMemFlag, err := createFlag(flag)
		if err != nil {
			return nil, err
		}

		flags[flag.Name] = inMemFlag
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

func createFlag(flag FeatureFlag) (memprovider.InMemoryFlag, error) {
	defaultVariant := "default"

	var value any
	var err error
	switch flag.Type {
	case Boolean:
		value = flag.Expression == "true"
	case String:
		value = flag.Expression
	case Integer:
		value, err = strconv.Atoi(flag.Expression)
	case Float:
		value, err = strconv.ParseFloat(flag.Expression, 64)
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
