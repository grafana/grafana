package searchV2

import (
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

type config struct {
	DashboardReIndexInterval       time.Duration
	DashboardEventsPollingInterval time.Duration
	DashboardIndexingBatchSize     int
}

func newConfig(cfg *setting.Cfg) config {
	settings := cfg.SectionWithEnvOverrides("search")
	c := config{
		DashboardReIndexInterval:       settings.Key("dashboard_reindex_interval").MustDuration(5 * time.Minute),
		DashboardEventsPollingInterval: settings.Key("dashboard_events_polling_interval").MustDuration(5 * time.Second),
		DashboardIndexingBatchSize:     settings.Key("dashboard_indexing_batch_size").MustInt(100),
	}
	return c
}
