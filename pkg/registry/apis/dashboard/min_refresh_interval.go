package dashboard

import (
	"context"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	requestcontext "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
)

// Keep in sync with min_refresh_interval in the [dashboards] section of conf/defaults.ini.
const defaultMinRefreshInterval = "5s"

// source=us selects the overrides stored in unified storage,
// so the settings service skips loading the defaults and from hgapi.
var minRefreshIntervalSelector = metav1.LabelSelector{
	MatchLabels: map[string]string{
		"section": "dashboards",
		"key":     "min_refresh_interval",
		"source":  "us",
	},
}

func (b *DashboardsAPIBuilder) validateRefreshInterval(ctx context.Context, namespace, refresh string) error {
	// An empty or auto refresh sets no fixed interval, so the floor does not apply and the settings lookup is skipped.
	if refresh == "" || refresh == "auto" {
		return nil
	}

	return b.dashboardService.ValidateDashboardRefreshInterval(b.minRefreshIntervalFor(ctx, namespace), refresh)
}

func (b *DashboardsAPIBuilder) minRefreshIntervalFor(ctx context.Context, namespace string) string {
	if b.settingService == nil {
		return b.minRefreshInterval
	}

	log := logging.FromContext(ctx).With("logger", "dashboard-min-refresh-interval", "namespace", namespace)
	settings, err := b.settingService.List(requestcontext.WithNamespace(ctx, namespace), minRefreshIntervalSelector)
	if err != nil {
		log.Warn("failed to read min_refresh_interval, using the default", "err", err)
		return b.minRefreshInterval
	}

	for _, s := range settings {
		if s == nil || s.Section != "dashboards" || s.Key != "min_refresh_interval" {
			continue
		}

		value := strings.TrimSpace(s.Value)
		if value == "" {
			return b.minRefreshInterval
		}

		if _, err := gtime.ParseDuration(value); err != nil {
			log.Warn("invalid min_refresh_interval, using the default", "value", value, "err", err)
			return b.minRefreshInterval
		}
		return value
	}

	return b.minRefreshInterval
}
