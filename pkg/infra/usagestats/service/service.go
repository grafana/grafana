package service

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type UsageStats struct {
	Cfg           *setting.Cfg
	Bus           bus.Bus
	SQLStore      *sqlstore.SQLStore
	pluginStore   plugins.Store
	SocialService social.Service
	kvStore       *kvstore.NamespacedKVStore
	RouteRegister routing.RouteRegister

	log log.MultiLoggers

	oauthProviders           map[string]bool
	externalMetrics          []usagestats.MetricsFunc
	concurrentUserStatsCache memoConcurrentUserStats
	startTime                time.Time
	sendReportCallbacks      []usagestats.SendReportCallbackFunc
}

func ProvideService(cfg *setting.Cfg, bus bus.Bus, sqlStore *sqlstore.SQLStore, pluginStore plugins.Store,
	socialService social.Service, kvStore kvstore.KVStore, routeRegister routing.RouteRegister,
) *UsageStats {
	s := &UsageStats{
		Cfg:            cfg,
		Bus:            bus,
		SQLStore:       sqlStore,
		oauthProviders: socialService.GetOAuthProviders(),
		RouteRegister:  routeRegister,
		pluginStore:    pluginStore,
		kvStore:        kvstore.WithNamespace(kvStore, 0, "infra.usagestats"),
		log:            log.New("infra.usagestats"),
		startTime:      time.Now(),
	}

	s.registerAPIEndpoints()

	return s
}

func (uss *UsageStats) Run(ctx context.Context) error {
	uss.updateTotalStats(ctx)

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

			for _, callback := range uss.sendReportCallbacks {
				callback()
			}
		case <-updateStatsTicker.C:
			uss.updateTotalStats(ctx)
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

func (uss *UsageStats) GetConcurrentUsersStats(ctx context.Context) (*concurrentUsersStats, error) {
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

func (uss *UsageStats) RegisterSendReportCallback(c usagestats.SendReportCallbackFunc) {
	uss.sendReportCallbacks = append(uss.sendReportCallbacks, c)
}
