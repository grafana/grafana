package setting

import (
	"time"
)

// DashboardDraftsSettings configures the expiry of dashboard drafts and forks.
type DashboardDraftsSettings struct {
	// IdleTTL is how long a draft or fork may go without a write before it moves to trash.
	IdleTTL time.Duration
	// CleanupInterval is how often expired drafts and forks are looked for.
	CleanupInterval time.Duration
	// BatchSize is how many drafts and forks are listed per request.
	BatchSize int64
}

const (
	defaultDashboardDraftsIdleTTL         = 30 * 24 * time.Hour
	defaultDashboardDraftsCleanupInterval = time.Hour
	defaultDashboardDraftsBatchSize       = int64(100)
	minDashboardDraftsIdleTTL             = time.Hour
	minDashboardDraftsCleanupInterval     = time.Minute
)

func (cfg *Cfg) readDashboardDraftsSettings() {
	section := cfg.Raw.Section("dashboard_drafts")

	idleTTL := section.Key("idle_ttl").MustDuration(defaultDashboardDraftsIdleTTL)
	if idleTTL < minDashboardDraftsIdleTTL {
		cfg.Logger.Warn("[dashboard_drafts.idle_ttl] is too low; the minimum allowed (1h) is enforced")
		idleTTL = minDashboardDraftsIdleTTL
	}
	interval := section.Key("cleanup_interval").MustDuration(defaultDashboardDraftsCleanupInterval)
	if interval < minDashboardDraftsCleanupInterval {
		cfg.Logger.Warn("[dashboard_drafts.cleanup_interval] is too low; the minimum allowed (1m) is enforced")
		interval = minDashboardDraftsCleanupInterval
	}
	batchSize := section.Key("batch_size").MustInt64(defaultDashboardDraftsBatchSize)
	if batchSize < 1 {
		batchSize = defaultDashboardDraftsBatchSize
	}

	cfg.DashboardDrafts = DashboardDraftsSettings{
		IdleTTL:         idleTTL,
		CleanupInterval: interval,
		BatchSize:       batchSize,
	}
}
