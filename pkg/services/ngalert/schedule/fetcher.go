package schedule

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// RulesStore is a store that provides alert rules for scheduling
type RulesStore interface {
	GetAlertRulesKeysForScheduling(ctx context.Context) ([]models.AlertRuleKeyWithVersion, error)
	GetAlertRulesForScheduling(ctx context.Context, query *models.GetAlertRulesForSchedulingQuery) error
}

type FetcherCfg struct {
	ReloadInterval       time.Duration
	DisableGrafanaFolder bool
}

// BackgroundFetcher periodically refreshes rules and folders in the background.
type BackgroundFetcher struct {
	cfg                FetcherCfg
	ticker             *time.Ticker
	ruleStore          RulesStore
	metrics            *metrics.Scheduler
	logger             log.Logger
	latestRules        []*models.AlertRule
	latestFolderTitles map[models.FolderKey]string
}

func NewBackgroundFetcher(cfg FetcherCfg, ruleStore RulesStore, metrics *metrics.Scheduler, logger log.Logger) *BackgroundFetcher {
	return &BackgroundFetcher{
		cfg:                cfg,
		ticker:             time.NewTicker(cfg.ReloadInterval),
		ruleStore:          ruleStore,
		metrics:            metrics,
		logger:             logger,
		latestRules:        make([]*models.AlertRule, 0),
		latestFolderTitles: make(map[models.FolderKey]string),
	}
}

func (f *BackgroundFetcher) Run(ctx context.Context) error {
	f.logger.Info("Starting rules fetcher")
	for {
		select {
		case <-f.ticker.C:
			f.logger.Debug("Refreshing rules from storage")
			f.updateSchedulableAlertRules(context.Background())
		case <-ctx.Done():
			f.ticker.Stop()
			f.logger.Info("Fetcher is shut down")
			return nil
		}
	}
}

func (f *BackgroundFetcher) Rules() ([]*models.AlertRule, map[models.FolderKey]string) {
	return f.latestRules, f.latestFolderTitles
}

func (f *BackgroundFetcher) updateSchedulableAlertRules(ctx context.Context) {
	start := time.Now()
	defer func() {
		f.metrics.UpdateSchedulableAlertRulesDuration.Observe(
			time.Since(start).Seconds(),
		)
	}()

	// At this point, we know we need to re-fetch rules as there are changes.
	q := models.GetAlertRulesForSchedulingQuery{
		PopulateFolders: !f.cfg.DisableGrafanaFolder,
	}
	if err := f.ruleStore.GetAlertRulesForScheduling(ctx, &q); err != nil {
		f.logger.Error("Failed to fetch alert rules", "error", err)
		return
	}

	f.latestRules = q.ResultRules
	f.latestFolderTitles = q.ResultFoldersTitles

	f.logger.Debug("Alert rules fetched", "rulesCount", len(f.latestRules), "foldersCount", len(f.latestFolderTitles))
}

// updateSchedulableAlertRules updates the alert rules for the scheduler.
// It returns diff that contains rule keys that were updated since the last poll,
// and an error if the database query encountered problems.
func (sch *schedule) updateSchedulableAlertRules(ctx context.Context) (diff, error) {
	start := time.Now()
	defer func() {
		sch.metrics.UpdateSchedulableAlertRulesDuration.Observe(
			time.Since(start).Seconds())
	}()

	if !sch.schedulableAlertRules.isEmpty() {
		keys, err := sch.ruleStore.GetAlertRulesKeysForScheduling(ctx)
		if err != nil {
			return diff{}, err
		}
		if !sch.schedulableAlertRules.needsUpdate(keys) {
			sch.log.Debug("No changes detected. Skip updating")
			return diff{}, nil
		}
	}
	// At this point, we know we need to re-fetch rules as there are changes.
	q := models.GetAlertRulesForSchedulingQuery{
		PopulateFolders: !sch.disableGrafanaFolder,
	}
	if err := sch.ruleStore.GetAlertRulesForScheduling(ctx, &q); err != nil {
		return diff{}, fmt.Errorf("failed to get alert rules: %w", err)
	}
	d := sch.schedulableAlertRules.set(q.ResultRules, q.ResultFoldersTitles)
	sch.log.Debug("Alert rules fetched", "rulesCount", len(q.ResultRules), "foldersCount", len(q.ResultFoldersTitles), "updatedRules", len(d.updated))
	return d, nil
}
