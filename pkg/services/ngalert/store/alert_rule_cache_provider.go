package store

import (
	"context"
	"time"

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
		logger.Info("Configuring remote cache (Redis) for alert rules")

		// Validate Redis connection before using it
		if remoteCache == nil {
			logger.Error("Remote cache requested but remoteCache is nil - falling back to local cache",
				"configured_type", cacheType,
				"redis_address", cfg.RemoteCacheOptions.ConnStr)
			return NewLocalAlertRuleCache(localCache, logger)
		}

		// Test Redis connectivity with a simple operation
		testCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		testKey := "alert_rules:health_check"
		testValue := []byte("ping")

		logger.Info("Testing Redis connection for alert rules cache",
			"redis_address", cfg.RemoteCacheOptions.ConnStr,
			"redis_prefix", cfg.RemoteCacheOptions.Prefix)

		// Try to set a value
		if err := remoteCache.Set(testCtx, testKey, testValue, 10*time.Second); err != nil {
			logger.Error("Failed to connect to Redis for alert rules cache - falling back to local cache",
				"error", err,
				"redis_address", cfg.RemoteCacheOptions.ConnStr,
				"operation", "SET")
			return NewLocalAlertRuleCache(localCache, logger)
		}

		// Try to get the value back
		if _, err := remoteCache.Get(testCtx, testKey); err != nil {
			logger.Error("Redis SET succeeded but GET failed for alert rules cache - falling back to local cache",
				"error", err,
				"redis_address", cfg.RemoteCacheOptions.ConnStr,
				"operation", "GET")
			return NewLocalAlertRuleCache(localCache, logger)
		}

		// Clean up test key
		_ = remoteCache.Delete(testCtx, testKey)

		logger.Info("✓ Redis connection successful for alert rules cache",
			"redis_address", cfg.RemoteCacheOptions.ConnStr,
			"cache_type", "remote")

		return NewRemoteAlertRuleCache(remoteCache, logger)

	case "local":
		fallthrough
	default:
		logger.Info("Using local in-memory cache for alert rules",
			"cache_type", cacheType)
		return NewLocalAlertRuleCache(localCache, logger)
	}
}
