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
	flags, err := buildStaticFlagsMap(confFlags, standardFlags)
	if err != nil {
		return nil, err
	}
	return newInMemoryBulkProvider(flags), nil
}

func buildStaticFlagsMap(confFlags map[string]memprovider.InMemoryFlag, standardFlags []FeatureFlag) (map[string]memprovider.InMemoryFlag, error) {
	flags := make(map[string]memprovider.InMemoryFlag, len(standardFlags))
	for _, flag := range standardFlags {
		inMemFlag, err := setting.ParseFlag(flag.Name, flag.Expression)
		if err != nil {
			return nil, fmt.Errorf("failed to parse flag %s: %w", flag.Name, err)
		}
		flags[flag.Name] = inMemFlag
	}
	maps.Copy(flags, confFlags)
	return flags, nil
}

func buildStaticFlagsMapFromCfg(cfg *setting.Cfg) (map[string]memprovider.InMemoryFlag, error) {
	confFlags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return nil, fmt.Errorf("failed to read feature flags from config: %w", err)
	}
	return buildStaticFlagsMap(confFlags, standardFeatureFlags)
}

func newStaticProviderFromCfg(cfg *setting.Cfg) (openfeature.FeatureProvider, error) {
	flags, err := buildStaticFlagsMapFromCfg(cfg)
	if err != nil {
		return nil, err
	}
	return newInMemoryBulkProvider(flags), nil
}
