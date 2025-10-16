package store

import (
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/setting"
)

// ProvideAlertRuleCache provides the appropriate cache implementation based on configuration
func ProvideAlertRuleCache(
	cfg *setting.Cfg,
	localCache *localcache.CacheService,
	remoteCache remotecache.CacheStorage,
) AlertRuleCache {
	logger := log.New("ngalert.cache")

	cacheType := cfg.UnifiedAlerting.AlertRuleCacheType
	if cacheType == "" {
		cacheType = "local" // Default to local cache
	}

	switch cacheType {
	case "remote":
		logger.Info("Using remote cache (Redis) for alert rules")
		return NewRemoteAlertRuleCache(remoteCache, logger)
	case "local":
		fallthrough
	default:
		logger.Info("Using local in-memory cache for alert rules")
		return NewLocalAlertRuleCache(localCache, logger)
	}
}
