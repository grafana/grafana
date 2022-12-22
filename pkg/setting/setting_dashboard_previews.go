package setting

import (
	"time"

	"gopkg.in/ini.v1"
)

type DashboardPreviewsSettings struct {
	SchedulerInterval time.Duration
	MaxCrawlDuration  time.Duration
	RenderingTimeout  time.Duration
	CrawlThreadCount  uint32
}

func readDashboardPreviewsSettings(iniFile *ini.File) DashboardPreviewsSettings {
	maxThreadCount := uint32(20)

	s := DashboardPreviewsSettings{}

	previewsCrawlerSection := iniFile.Section("dashboard_previews.crawler")
	s.CrawlThreadCount = uint32(previewsCrawlerSection.Key("thread_count").MustUint(6))
	if s.CrawlThreadCount > maxThreadCount {
		s.CrawlThreadCount = maxThreadCount
	}

	s.SchedulerInterval = previewsCrawlerSection.Key("scheduler_interval").MustDuration(12 * time.Hour)
	s.MaxCrawlDuration = previewsCrawlerSection.Key("max_crawl_duration").MustDuration(1 * time.Hour)
	s.RenderingTimeout = previewsCrawlerSection.Key("rendering_timeout").MustDuration(20 * time.Second)
	return s
}
