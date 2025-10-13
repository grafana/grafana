package store

import (
	"context"
	"fmt"
	"time"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	// AlertRuleCacheTTL defines how long to cache alert rules (5 minutes)
	// Since we invalidate on CUD operations, we can afford a longer TTL
	AlertRuleCacheTTL = 5 * time.Minute
)

// ServerTimingCollector interface for recording metrics (avoids circular import)
type ServerTimingCollector interface {
	RecordCacheHit(duration time.Duration)
	RecordCacheMiss(duration time.Duration)
	RecordDBQuery(duration time.Duration)
	RecordStateManagerQuery(duration time.Duration)
}

// Context key for Server-Timing collector (must match api package exactly)
// Using string to avoid type mismatch across packages
const serverTimingCollectorKey = "grafana.server-timing-collector"

// getTimingCollectorFromContext extracts timing collector from context
func getTimingCollectorFromContext(ctx context.Context) ServerTimingCollector {
	if collector, ok := ctx.Value(serverTimingCollectorKey).(ServerTimingCollector); ok {
		return collector
	}
	return nil
}

// alertRuleCacheKey generates a cache key for alert rules based on orgID only
// We cache all rules together (alerting + recording) and filter by type in-memory
func alertRuleCacheKey(orgID int64, ruleType ngmodels.RuleTypeFilter) string {
	return fmt.Sprintf("alert-rules:%d", orgID)
}

// getCachedAlertRules retrieves cached alert rules for an organization and rule type
// This version accepts a context to report timing metrics to Server-Timing collector if present
func (st *DBstore) getCachedAlertRules(ctx context.Context, orgID int64, ruleType ngmodels.RuleTypeFilter) (ngmodels.RulesGroup, bool) {
	start := time.Now()
	defer func() {
		// Report cache timing to Server-Timing collector if present in context
		if collector := getTimingCollectorFromContext(ctx); collector != nil {
			duration := time.Since(start)
			// Record will be done by caller based on hit/miss
			_ = duration
		}
	}()

	if st.CacheService == nil {
		st.Logger.Info("Cache service is nil")
		return nil, false
	}

	key := alertRuleCacheKey(orgID, ruleType)
	st.Logger.Info("Cache get", "key", key)

	start = time.Now() // Start timing just the cache lookup
	cached, found := st.CacheService.Get(key)
	cacheDuration := time.Since(start)

	// Report cache hit/miss to timing collector
	if collector := getTimingCollectorFromContext(ctx); collector != nil {
		if found {
			collector.RecordCacheHit(cacheDuration)
		} else {
			collector.RecordCacheMiss(cacheDuration)
		}
	}

	if !found {
		st.Logger.Info("Cache miss", "key", key)
		return nil, false
	}
	st.Logger.Info("Cache hit!", "key", key, "rules_count", len(cached.(ngmodels.RulesGroup)))

	rules, ok := cached.(ngmodels.RulesGroup)
	if !ok {
		// Cache corruption - invalidate
		st.CacheService.Delete(key)
		return nil, false
	}

	return rules, true
}

// setCachedAlertRules stores alert rules in the cache for an organization and rule type
func (st *DBstore) setCachedAlertRules(orgID int64, ruleType ngmodels.RuleTypeFilter, rules ngmodels.RulesGroup) {
	if st.CacheService == nil {
		st.Logger.Info("Cache service is nil - cannot set cache")
		return
	}

	key := alertRuleCacheKey(orgID, ruleType)
	st.Logger.Info("Setting cache", "key", key, "rules_count", len(rules), "ttl", AlertRuleCacheTTL)
	st.CacheService.Set(key, rules, AlertRuleCacheTTL)
	st.Logger.Info("Cache set complete", "key", key)
}

// invalidateAlertRulesCache invalidates all cached alert rules for an organization
// This is called when rules are created, updated, or deleted
func (st *DBstore) invalidateAlertRulesCache(orgID int64) {
	if st.CacheService == nil {
		return
	}

	// Since we only cache by orgID (not by rule type), just delete one key
	key := alertRuleCacheKey(orgID, ngmodels.RuleTypeFilterAll) // ruleType param ignored, just for signature
	st.CacheService.Delete(key)

	st.Logger.Debug("Invalidated alert rules cache", "org_id", orgID, "key", key)
}
