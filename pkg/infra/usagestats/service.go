package usagestats

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

var metricsLogger log.Logger = log.New("metrics")

func init() {
	registry.RegisterService(&UsageStatsService{})
}

type UsageStats interface {
	GetUsageReport(ctx context.Context) (UsageReport, error)

	RegisterMetric(name string, fn MetricFunc)
}

type MetricFunc func() (interface{}, error)

type UsageStatsService struct {
	Cfg                *setting.Cfg               `inject:""`
	Bus                bus.Bus                    `inject:""`
	SQLStore           *sqlstore.SQLStore         `inject:""`
	AlertingUsageStats alerting.UsageStatsQuerier `inject:""`
	License            models.Licensing           `inject:""`

	log log.Logger

	oauthProviders           map[string]bool
	externalMetrics          map[string]MetricFunc
	concurrentUserStatsCache memoConcurrentUserStats
}

func (uss *UsageStatsService) Init() error {
	uss.log = log.New("infra.usagestats")
	uss.oauthProviders = social.GetOAuthProviders(uss.Cfg)
	uss.externalMetrics = make(map[string]MetricFunc)
	return nil
}

func (uss *UsageStatsService) Run(ctx context.Context) error {
	uss.updateTotalStats()

	onceEveryDayTick := time.NewTicker(time.Hour * 24)
	everyMinuteTicker := time.NewTicker(time.Minute)
	defer onceEveryDayTick.Stop()
	defer everyMinuteTicker.Stop()

	for {
		select {
		case <-onceEveryDayTick.C:
			if err := uss.sendUsageStats(ctx); err != nil {
				metricsLogger.Warn("Failed to send usage stats", "err", err)
			}
		case <-everyMinuteTicker.C:
			uss.updateTotalStats()
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

type memoConcurrentUserStats struct {
	stats *concurrentUsersStats

	memoized time.Time
}

const concurrentUserStatsCacheLifetime = time.Hour

func (uss *UsageStatsService) GetConcurrentUsersStats(ctx context.Context) (*concurrentUsersStats, error) {
	err := uss.updateConcurrentUsersStatsIfNecessary(ctx)
	if err != nil {
		return nil, err
	}
	return uss.concurrentUserStatsCache.stats, nil
}

func (uss *UsageStatsService) updateConcurrentUsersStatsIfNecessary(ctx context.Context) error {
	memoizationPeriod := time.Now().Add(-concurrentUserStatsCacheLifetime)
	if uss.concurrentUserStatsCache.memoized.Before(memoizationPeriod) {
		err := uss.updateConcurrentUsersStats(ctx)
		if err != nil {
			return err
		}
	}

	return nil
}

func (uss *UsageStatsService) updateConcurrentUsersStats(ctx context.Context) error {
	uss.concurrentUserStatsCache.stats = &concurrentUsersStats{}
	err := uss.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// Retrieves concurrent users stats as a histogram. Buckets are accumulative and upper bound is inclusive.
		var rawSql = `
SELECT
    COUNT(CASE WHEN tokens <= 3 THEN 1 END) AS bucket_le_3,
    COUNT(CASE WHEN tokens <= 6 THEN 1 END) AS bucket_le_6,
    COUNT(CASE WHEN tokens <= 9 THEN 1 END) AS bucket_le_9,
    COUNT(CASE WHEN tokens <= 12 THEN 1 END) AS bucket_le_12,
    COUNT(CASE WHEN tokens <= 15 THEN 1 END) AS bucket_le_15,
    COUNT(1) AS bucket_le_inf
FROM (select count(1) as tokens from user_auth_token group by user_id) uat;`
		_, err := sess.SQL(rawSql).Get(uss.concurrentUserStatsCache.stats)
		if err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return err
	}
	uss.concurrentUserStatsCache.memoized = time.Now()
	return nil
}
