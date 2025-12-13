package featuremgmt

import (
	"encoding/json"
	"strconv"

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

// newStaticProvider creates a provider with support for different flag types
func newStaticProvider(typedFlags map[string]setting.TypedFeatureFlag) (openfeature.FeatureProvider, error) {
	flags := make(map[string]memprovider.InMemoryFlag, len(standardFeatureFlags)+len(typedFlags))

	// Add standard flags first (these are always boolean)
	for _, flag := range standardFeatureFlags {
		enabled := flag.Expression == "true"
		flags[flag.Name] = createBooleanFlag(flag.Name, enabled)
	}

	// Add typed flags from config (these can override standard flags)
	for n, f := range typedFlags {
		flags[n] = createTypedFlag(n, f.Type, f.Value)
	}

	return newInMemoryBulkProvider(flags), nil
}

type FlagType string

const (
	FlagTypeBoolean FlagType = "boolean"
	FlagTypeString  FlagType = "string"
	FlagTypeNumber  FlagType = "number" // TODO: check in OFREP spec
	FlagTypeObject  FlagType = "object"
)

// TypedFlag represents a flag with its type and value
type TypedFlag struct {
	Name  string
	Type  FlagType
	Value interface{}
}

func createTypedFlag(name, flagType string, value interface{}) memprovider.InMemoryFlag {
	switch flagType {
	case "boolean":
		return createBooleanFlag(name, value.(bool))
	case "string":
		return createStringFlag(name, value.(string))
	case "number":
		return createNumberFlag(name, value.(float64))
	case "object":
		return createObjectFlag(name, value.(map[string]interface{}))
	default:
		// Default to boolean for backward compatibility
		return createBooleanFlag(name, false)
	}
}

func createBooleanFlag(name string, value bool) memprovider.InMemoryFlag {
	variant := "disabled"
	if value {
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

func createStringFlag(name string, value string) memprovider.InMemoryFlag {
	return memprovider.InMemoryFlag{
		Key:            name,
		DefaultVariant: "default",
		Variants: map[string]interface{}{
			"default": value,
		},
	}
}

func createNumberFlag(name string, value float64) memprovider.InMemoryFlag {
	return memprovider.InMemoryFlag{
		Key:            name,
		DefaultVariant: "default",
		Variants: map[string]interface{}{
			"default": value,
		},
	}
}

func createObjectFlag(name string, value map[string]interface{}) memprovider.InMemoryFlag {
	return memprovider.InMemoryFlag{
		Key:            name,
		DefaultVariant: "default",
		Variants: map[string]interface{}{
			"default": value,
		},
	}
}

// parseTypedFlagValue attempts to parse a string value into the appropriate type
func parseTypedFlagValue(value string) (interface{}, FlagType, error) {
	// Try to parse as boolean
	if boolVal, err := strconv.ParseBool(value); err == nil {
		return boolVal, FlagTypeBoolean, nil
	}

	// Try to parse as number
	if numVal, err := strconv.ParseFloat(value, 64); err == nil {
		return numVal, FlagTypeNumber, nil
	}

	// Try to parse as JSON object
	var objVal map[string]interface{}
	if err := json.Unmarshal([]byte(value), &objVal); err == nil {
		return objVal, FlagTypeObject, nil
	}

	// Default to string
	return value, FlagTypeString, nil
}
