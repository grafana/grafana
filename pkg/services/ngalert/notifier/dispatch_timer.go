package notifier

import (
	"context"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// GetDispatchTimer returns the appropriate dispatch timer based on feature toggles.
func GetDispatchTimer(ctx context.Context, features featuremgmt.FeatureToggles) (dt alertingNotify.DispatchTimer) {
	if features.IsEnabled(ctx, featuremgmt.FlagAlertingSyncDispatchTimer) {
		dt = alertingNotify.DispatchTimerSync
	}
	return
}
