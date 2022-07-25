package searchV2

import (
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

type config struct {
	DashboardReIndexInterval       time.Duration
	DashboardEventsPollingInterval time.Duration
}

func newConfig(cfg *setting.Cfg) config {
	settings := cfg.SectionWithEnvOverrides("search")
	c := config{
		DashboardReIndexInterval:       settings.Key("dashboard_reindex_interval").MustDuration(5 * time.Minute),
		DashboardEventsPollingInterval: settings.Key("dashboard_events_polling_interval").MustDuration(5 * time.Second),
	}
	return c
}
