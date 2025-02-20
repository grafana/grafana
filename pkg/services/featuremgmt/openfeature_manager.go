package featuremgmt

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
)

// assert that OpenFeatureManager implements the FeatureToggles and GrafanaProvider interfaces
var _ FeatureToggles = (*OpenFeatureManager)(nil)
var _ GrafanaSpecificInterface = (*OpenFeatureManager)(nil)

// This is the current Feature Management interface used by Grafana
// TODO: Not sure if it's new manager that needs to implement it, or rather all the providers and feature manager just delegates to them
type GrafanaSpecificInterface interface {
	// GetEnabled returns a map containing only the features that are enabled
	GetEnabled(ctx context.Context) map[string]bool

	// GetFlags returns all flag definitions
	GetFlags() []FeatureFlag

	// GetFlag returns the named flag definition or nil if not found
	GetFlag(key string) *FeatureFlag

	// GetStartupFlags returns the flags that were explicitly set on startup
	GetStartupFlags() map[string]bool

	// GetWarnings returns any warnings about the flags
	GetWarnings() map[string]string

	// SetRestartRequired indicates that a change has been made that requires a
	// restart
	SetRestartRequired()

	// IsRestartRequired - indicate if a change has been made that requires a
	// restart (not that accurate, but better than nothing)
	IsRestartRequired() bool
}

type OpenFeatureManager struct {
	provider openfeature.FeatureProvider

	Client openfeature.IClient
}

func ProvideOpenFeatureManager(cfg *setting.Cfg) (*OpenFeatureManager, error) {
	provType := cfg.SectionWithEnvOverrides("feature_mgmt").Key("provider").MustString("static")
	url := cfg.SectionWithEnvOverrides("feature_mgmt").Key("url").MustString("")
	key := cfg.SectionWithEnvOverrides("feature_mgmt").Key("instance_slug").MustString("")

	var provider openfeature.FeatureProvider
	var err error
	if provType == "goff" {
		provider, err = newGOFFProvider(url)
	} else {
		provider, err = newStaticProvider(cfg)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create feature provider: %w", err)
	}

	if err := openfeature.SetProviderAndWait(provider); err != nil {
		return nil, fmt.Errorf("failed to set global feature provider: %w", err)
	}

	// TODO: do not know if key is needed here
	// TODO: idk whether slug makes any sense for on-prem grafana
	openfeature.SetEvaluationContext(openfeature.NewEvaluationContext(
		key,
		map[string]interface{}{
			"slug":            key,
			"grafana_version": cfg.BuildVersion,
		}))

	client := openfeature.NewClient("grafana-featuremgmt-client")

	return &OpenFeatureManager{
		provider: provider,
		Client:   client,
	}, nil
}

func (n OpenFeatureManager) GetFlags() []FeatureFlag {
	p, ok := n.provider.(*staticProvider)
	if !ok {
		panic("not implemented for OpenFeature provider")
	}
	return p.GetFlags()
}

func (n OpenFeatureManager) GetFlag(key string) *FeatureFlag {
	panic("implement me")
}

func (n OpenFeatureManager) GetStartupFlags() map[string]bool {
	panic("implement me")
}

func (n OpenFeatureManager) GetWarnings() map[string]string {
	panic("implement me")
}

func (n OpenFeatureManager) SetRestartRequired() {
	panic("implement me")
}

func (n OpenFeatureManager) IsRestartRequired() bool {
	panic("implement me")
}

func (n OpenFeatureManager) IsEnabled(ctx context.Context, flag string) bool {
	panic("implement me")
}

func (n OpenFeatureManager) IsEnabledGlobally(flag string) bool {
	panic("implement me")
}

func (n OpenFeatureManager) GetEnabled(ctx context.Context) map[string]bool {
	panic("implement me")
}
