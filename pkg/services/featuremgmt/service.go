package featuremgmt

import (
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	// The values are updated each time
	featureToggleInfo = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "feature_toggles_info",
		Help:      "info metric that exposes what feature toggles are enabled or not",
		Namespace: "grafana",
	}, []string{"name"})
)

func ProvideManagerService(cfg *setting.Cfg, provider FeatureProvider, client openfeature.IClient) (*FeatureManager, error) {
	logger := log.New("featuremgmt")

	mgmt := newFeatureManager(cfg.FeatureManagement, logger, provider, client)

	// Minimum approach to avoid circular dependency
	// nolint:staticcheck
	cfg.IsFeatureToggleEnabled = mgmt.IsEnabledGlobally

	return mgmt, nil
}

// ProvideToggles allows read-only access to the feature state
//
// Deprecated: Use an [openfeature.IClient] instead (see
// [ProvideOpenFeatureClient])
func ProvideToggles(mgmt *FeatureManager) FeatureToggles {
	return mgmt
}

func ProvideFeatureProvider(cfg *setting.Cfg) (FeatureProvider, error) {
	// Load the flags from `custom.ini` files
	flags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return nil, fmt.Errorf("reading feature toggles: %w", err)
	}

	logger := log.New("featuremgmt")
	prov := newProvider(cfg.Env != setting.Prod, logger)
	prov.register(flags, standardFeatureFlags...)

	if err = openfeature.SetProviderAndWait(prov); err != nil {
		return nil, fmt.Errorf("failed to set openfeature provider: %w", err)
	}

	// set the global evaluation context - these are values that cannot change
	// during the process lifetime
	openfeature.SetEvaluationContext(openfeature.NewTargetlessEvaluationContext(map[string]interface{}{
		"grafana.version": cfg.BuildVersion,
		// TODO: add environment info too?
	}))

	return prov, nil
}

// ProvideOpenFeatureClient provides the OpenFeature client.
// For now it requires the FeatureProvider to be passed in to ensure that the
// provider is properly configured and registered first.
func ProvideOpenFeatureClient(prov FeatureProvider) (openfeature.IClient, error) {
	return openfeature.NewClient("grafana"), nil
}
