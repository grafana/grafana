package featuremgmt

import (
	"sort"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"golang.org/x/exp/maps"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// The values are updated each time
var featureToggleInfo = promauto.NewGaugeVec(prometheus.GaugeOpts{
	Name:      "feature_toggles_info",
	Help:      "info metric that exposes what feature toggles are enabled or not",
	Namespace: "grafana",
}, []string{"name"})

func ProvideManagerService(settingsProvider setting.SettingsProvider) (*FeatureManager, error) {
	cfg := settingsProvider.Get()
	mgmt := &FeatureManager{
		isDevMod: cfg.Env != setting.Prod,
		flags:    make(map[string]*FeatureFlag, 30),
		enabled:  make(map[string]bool),
		startup:  make(map[string]bool),
		warnings: make(map[string]string),
		Settings: cfg.FeatureManagement,
		log:      log.New("featuremgmt"),
	}

	// Register the standard flags
	mgmt.registerFlags(standardFeatureFlags...)

	// Load the flags from `custom.ini` files
	flags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return mgmt, err
	}
	for key, val := range flags {
		_, ok := mgmt.flags[key]
		if !ok {
			mgmt.flags[key] = &FeatureFlag{
				Name:  key,
				Stage: FeatureStageUnknown,
			}
			mgmt.warnings[key] = "unknown flag in config"
		}
		mgmt.startup[key] = val
	}

	// update the values
	mgmt.update()

	// Log the enabled feature toggles at startup
	enabled := sort.StringSlice(maps.Keys(mgmt.enabled))
	logctx := make([]any, len(enabled)*2)
	for i, k := range enabled {
		logctx[(i * 2)] = k
		logctx[(i*2)+1] = true
	}
	mgmt.log.Info("FeatureToggles", logctx...)

	// Minimum approach to avoid circular dependency
	// nolint:staticcheck
	cfg.IsFeatureToggleEnabled = mgmt.IsEnabledGlobally
	return mgmt, nil
}

// ProvideToggles allows read-only access to the feature state
func ProvideToggles(mgmt *FeatureManager) FeatureToggles {
	return mgmt
}
