package setting

import (
	"time"

	"gopkg.in/ini.v1"
)

type SearchSettings struct {
	FullReindexInterval       time.Duration
	IndexUpdateInterval       time.Duration
	DashboardLoadingBatchSize int
}

func readSearchSettings(iniFile *ini.File) SearchSettings {
	s := SearchSettings{}

	searchSection := iniFile.Section("search")
	s.DashboardLoadingBatchSize = searchSection.Key("dashboard_loading_batch_size").MustInt(200)
	s.FullReindexInterval = searchSection.Key("full_reindex_interval").MustDuration(5 * time.Minute)
	s.IndexUpdateInterval = searchSection.Key("index_update_interval").MustDuration(10 * time.Second)
	return s
}
