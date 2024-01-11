package featuremgmt

import (
	"os"
	"path/filepath"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/licensing"
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

func ProvideManagerService(cfg *setting.Cfg, licensing licensing.Licensing) (*FeatureManager, error) {
	mgmt := &FeatureManager{
		isDevMod:     setting.Env != setting.Prod,
		licensing:    licensing,
		flags:        make(map[string]*FeatureFlag, 30),
		enabled:      make(map[string]bool),
		startup:      make(map[string]bool),
		warnings:     make(map[string]string),
		allowEditing: cfg.FeatureManagement.AllowEditing && cfg.FeatureManagement.UpdateWebhook != "",
		log:          log.New("featuremgmt"),
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
			switch key {
			// renamed the flag so it supports more panels
			case "autoMigrateGraphPanels":
				key = FlagAutoMigrateOldPanels
			default:
				mgmt.flags[key] = &FeatureFlag{
					Name:  key,
					Stage: FeatureStageUnknown,
				}
				mgmt.warnings[key] = "unknown flag in config"
			}
		}
		mgmt.startup[key] = val
	}

	// Load config settings
	configfile := filepath.Join(cfg.HomePath, "conf", "features.yaml")
	if _, err := os.Stat(configfile); err == nil {
		mgmt.log.Info("[experimental] loading features from config file", "path", configfile)
		mgmt.config = configfile
		err = mgmt.readFile()
		if err != nil {
			return mgmt, err
		}
	}

	// update the values
	mgmt.update()

	// Minimum approach to avoid circular dependency
	// nolint:staticcheck
	cfg.IsFeatureToggleEnabled = mgmt.IsEnabledGlobally
	return mgmt, nil
}

// ProvideToggles allows read-only access to the feature state
func ProvideToggles(mgmt *FeatureManager) FeatureToggles {
	return mgmt
}
