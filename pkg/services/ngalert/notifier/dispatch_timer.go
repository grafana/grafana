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

	if enabled {
		dt = alertingNotify.DispatchTimerSync
	}

	log.New("dispatchTimer.GetDispatchTimer").Info("GetDispatchTimer", "enabled", enabled, "dispatch_timer", dt.String())
	return
}
