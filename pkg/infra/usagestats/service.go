package usagestats

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type UsageStats interface {
	GetUsageReport(context.Context) (UsageReport, error)
	RegisterMetricsFunc(MetricsFunc)
	ShouldBeReported(string) bool
}

type MetricsFunc func() (map[string]interface{}, error)

type UsageStatsService struct {
	Cfg                *setting.Cfg
	Bus                bus.Bus
	SQLStore           *sqlstore.SQLStore
	AlertingUsageStats alerting.UsageStatsQuerier
	PluginManager      plugins.Manager
	SocialService      social.Service
	grafanaLive        *live.GrafanaLive
	kvStore            *kvstore.NamespacedKVStore

	log log.Logger

	oauthProviders           map[string]bool
	externalMetrics          []MetricsFunc
	concurrentUserStatsCache memoConcurrentUserStats
	liveStats                liveUsageStats
	startTime                time.Time
}

type liveUsageStats struct {
	numClientsMax int
	numClientsMin int
	numClientsSum int
	numUsersMax   int
	numUsersMin   int
	numUsersSum   int
	sampleCount   int
}

func ProvideService(cfg *setting.Cfg, bus bus.Bus, sqlStore *sqlstore.SQLStore,
	alertingStats alerting.UsageStatsQuerier, pluginManager plugins.Manager,
	socialService social.Service, grafanaLive *live.GrafanaLive,
	kvStore kvstore.KVStore) *UsageStatsService {
	s := &UsageStatsService{
		Cfg:                cfg,
		Bus:                bus,
		SQLStore:           sqlStore,
		AlertingUsageStats: alertingStats,
		oauthProviders:     socialService.GetOAuthProviders(),
		PluginManager:      pluginManager,
		grafanaLive:        grafanaLive,
		kvStore:            kvstore.WithNamespace(kvStore, 0, "infra.usagestats"),
		log:                log.New("infra.usagestats"),
		startTime:          time.Now(),
	}
	return s
}

func (uss *UsageStatsService) Run(ctx context.Context) error {
	uss.updateTotalStats()

	// try to load last sent time from kv store
	lastSent := time.Now()
	if val, ok, err := uss.kvStore.Get(ctx, "last_sent"); err != nil {
		uss.log.Error("Failed to get last sent time", "error", err)
	} else if ok {
		if parsed, err := time.Parse(time.RFC3339, val); err != nil {
			uss.log.Error("Failed to parse last sent time", "error", err)
		} else {
			lastSent = parsed
		}
	}

	// calculate initial send delay
	sendInterval := time.Hour * 24
	nextSendInterval := time.Until(lastSent.Add(sendInterval))
	if nextSendInterval < time.Minute {
		nextSendInterval = time.Minute
	}

	sendReportTicker := time.NewTicker(nextSendInterval)
	updateStatsTicker := time.NewTicker(time.Minute * 30)

	defer sendReportTicker.Stop()
	defer updateStatsTicker.Stop()

	for {
		select {
		case <-sendReportTicker.C:
			if err := uss.sendUsageStats(ctx); err != nil {
				uss.log.Warn("Failed to send usage stats", "error", err)
			}

			lastSent = time.Now()
			if err := uss.kvStore.Set(ctx, "last_sent", lastSent.Format(time.RFC3339)); err != nil {
				uss.log.Warn("Failed to update last sent time", "error", err)
			}

			if nextSendInterval != sendInterval {
				nextSendInterval = sendInterval
				sendReportTicker.Reset(nextSendInterval)
			}

			// always reset live stats every report tick
			uss.resetLiveStats()
		case <-updateStatsTicker.C:
			uss.updateTotalStats()
			uss.sampleLiveStats()
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
	memoizationPeriod := time.Now().Add(-concurrentUserStatsCacheLifetime)
	if !uss.concurrentUserStatsCache.memoized.Before(memoizationPeriod) {
		return uss.concurrentUserStatsCache.stats, nil
	}

	uss.concurrentUserStatsCache.stats = &concurrentUsersStats{}
	err := uss.SQLStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// Retrieves concurrent users stats as a histogram. Buckets are accumulative and upper bound is inclusive.
		rawSQL := `
SELECT
    COUNT(CASE WHEN tokens <= 3 THEN 1 END) AS bucket_le_3,
    COUNT(CASE WHEN tokens <= 6 THEN 1 END) AS bucket_le_6,
    COUNT(CASE WHEN tokens <= 9 THEN 1 END) AS bucket_le_9,
    COUNT(CASE WHEN tokens <= 12 THEN 1 END) AS bucket_le_12,
    COUNT(CASE WHEN tokens <= 15 THEN 1 END) AS bucket_le_15,
    COUNT(1) AS bucket_le_inf
FROM (select count(1) as tokens from user_auth_token group by user_id) uat;`
		_, err := sess.SQL(rawSQL).Get(uss.concurrentUserStatsCache.stats)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get concurrent users stats from database: %w", err)
	}

	uss.concurrentUserStatsCache.memoized = time.Now()
	return uss.concurrentUserStatsCache.stats, nil
}
