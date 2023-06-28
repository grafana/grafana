package angulardetectorsprovider

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// DynamicUpdater is the background service that periodically updates the dynamic angular detectors in the background.
type DynamicUpdater interface {
	registry.BackgroundService
}

// noOpDynamicUpdater is a DynamicUpdater that immediately returns nil.
type noOpDynamicUpdater struct{}

// Run returns nil.
func (s *noOpDynamicUpdater) Run(_ context.Context) error {
	return nil
}

// ProvideDynamicUpdater returns either dynamic, or a new noOpDynamicUpdater, depending on
// whether featuremgmt.FlagPluginsDynamicAngularDetectionPatterns is enabled or not.
func ProvideDynamicUpdater(cfg *config.Cfg, dynamic *Dynamic) DynamicUpdater {
	if cfg.Features != nil && cfg.Features.IsEnabled(featuremgmt.FlagPluginsDynamicAngularDetectionPatterns) {
		return dynamic
	}
	return &noOpDynamicUpdater{}
}
