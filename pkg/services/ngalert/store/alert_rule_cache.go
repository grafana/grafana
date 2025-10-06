package store

import (
	"fmt"
	"time"

	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	// AlertRuleCacheTTL defines how long to cache alert rules (5 minutes)
	// Since we invalidate on CUD operations, we can afford a longer TTL
	AlertRuleCacheTTL = 5 * time.Minute
)

// alertRuleCacheKey generates a cache key for alert rules based on orgID only
// We cache all rules together (alerting + recording) and filter by type in-memory
func alertRuleCacheKey(orgID int64, ruleType ngmodels.RuleTypeFilter) string {
	return fmt.Sprintf("alert-rules:%d", orgID)
}

// getCachedAlertRules retrieves cached alert rules for an organization and rule type
func (st *DBstore) getCachedAlertRules(orgID int64, ruleType ngmodels.RuleTypeFilter) (ngmodels.RulesGroup, bool) {
	if st.CacheService == nil {
		st.Logger.Info("Cache service is nil")
		return nil, false
	}

	key := alertRuleCacheKey(orgID, ruleType)
	st.Logger.Info("Cache get", "key", key)
	cached, found := st.CacheService.Get(key)
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
