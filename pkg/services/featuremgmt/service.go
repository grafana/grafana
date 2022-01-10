package featuremgmt

import (
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// The values are updated each time
	featureToggleInfo = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name:      "feature_toggles_info",
		Help:      "info metric that exposes what feature toggles are enabled or not",
		Namespace: "grafana",
	}, []string{"name"})
)

func ProvideManagerService(cfg *setting.Cfg) (*FeatureManager, error) {
	mgmt := &FeatureManager{
		flags:   make(map[string]*FeatureFlag, 30),
		enabled: make(map[string]bool),
	}

	// Register the standard flags
	mgmt.registerFlags(standardFeatureFlags...)

	// Load the flags from `custom.ini` files
	flags, err := setting.ReadFeatureTogglesFromInitFile(cfg.Raw.Section("feature_toggles"))
	if err != nil {
		return mgmt, err
	}
	for key, val := range flags {
		flag, ok := mgmt.flags[key]
		if !ok {
			flag = &FeatureFlag{
				Name:  key,
				State: FeatureStateUnknown,
			}
			mgmt.flags[key] = flag
		}
		flag.Expression = fmt.Sprintf("%t", val) // true | false
	}

	// update the values
	mgmt.evaluate()

	// Mimimum approach to avoid circular dependency
	cfg.IsFeatureToggleEnabled = mgmt.IsEnabled
	return mgmt, nil
}

// interface without control
func ProvideToggles(mgmt *FeatureManager) *FeatureToggles {
	return &FeatureToggles{
		manager: mgmt,
	}
}
