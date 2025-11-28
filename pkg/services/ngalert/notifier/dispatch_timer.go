package notifier

import (
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// GetDispatchTimer returns the appropriate dispatch timer based on feature toggles.
func GetDispatchTimer(features featuremgmt.FeatureToggles) (dt alertingNotify.DispatchTimer) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	enabled := features.IsEnabledGlobally(featuremgmt.FlagAlertingSyncDispatchTimer)
	log.New("ngalert.dispatchTimer").Info("GetDispatchTimer called", "enabled", enabled, "result", dt.String())

	if enabled {
		dt = alertingNotify.DispatchTimerSync
	}
	return
}
