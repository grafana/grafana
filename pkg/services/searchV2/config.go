package searchV2

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/setting"
)

type config struct {
	DashboardReIndexInterval       time.Duration
	DashboardEventsPollingInterval time.Duration
	DashboardIndexingBatchSize     int
	DashboardReindexingBatchSize   int
	DashboardBackup                backupMode
	DashboardBackupDiskPath        string
}

func newConfig(cfg *setting.Cfg) (config, error) {
	settings := cfg.SectionWithEnvOverrides("search")

	c := config{
		DashboardReIndexInterval:       settings.Key("dashboard_reindex_interval").MustDuration(5 * time.Minute),
		DashboardEventsPollingInterval: settings.Key("dashboard_events_polling_interval").MustDuration(5 * time.Second),
		DashboardIndexingBatchSize:     settings.Key("dashboard_indexing_batch_size").MustInt(100),
		DashboardReindexingBatchSize:   settings.Key("dashboard_reindexing_batch_size").MustInt(100),
		DashboardBackupDiskPath:        settings.Key("dashboard_backup_disk_path").MustString(""),
	}

	var backMode = settings.Key("dashboard_backup").MustString("")
	switch backMode {
	case "", "none":
		c.DashboardBackup = backupModeNone
	case "sql":
		c.DashboardBackup = backupModeSql
	case "disk":
		c.DashboardBackup = backupModeDisk
	default:
		return config{}, fmt.Errorf("unknown dashboard index backup mode: %s", backMode)
	}

	return c, nil
}
