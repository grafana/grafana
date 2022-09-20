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

	previewsCrawlerSection := iniFile.Section("search")
	s.DashboardLoadingBatchSize = previewsCrawlerSection.Key("dashboard_loading_batch_size").MustInt(200)
	s.FullReindexInterval = previewsCrawlerSection.Key("full_reindex_interval").MustDuration(5 * time.Minute)
	s.IndexUpdateInterval = previewsCrawlerSection.Key("index_update_interval").MustDuration(10 * time.Second)
	return s
}
