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

// alertRuleCacheKey generates a cache key for alert rules based on orgID and rule type
func alertRuleCacheKey(orgID int64, ruleType ngmodels.RuleTypeFilter) string {
	return fmt.Sprintf("alert-rules:%d:%s", orgID, ruleType)
}

// getCachedAlertRules retrieves cached alert rules for an organization and rule type
func (st *DBstore) getCachedAlertRules(orgID int64, ruleType ngmodels.RuleTypeFilter) (ngmodels.RulesGroup, bool) {
	if st.CacheService == nil {
		return nil, false
	}

	key := alertRuleCacheKey(orgID, ruleType)
	cached, found := st.CacheService.Get(key)
	if !found {
		return nil, false
	}

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
		return
	}

	key := alertRuleCacheKey(orgID, ruleType)
	st.CacheService.Set(key, rules, AlertRuleCacheTTL)
}

// invalidateAlertRulesCache invalidates all cached alert rules for an organization
// This is called when rules are created, updated, or deleted
func (st *DBstore) invalidateAlertRulesCache(orgID int64) {
	if st.CacheService == nil {
		return
	}

	// Invalidate both alerting and recording rule caches for the org
	st.CacheService.Delete(alertRuleCacheKey(orgID, ngmodels.RuleTypeFilterAlerting))
	st.CacheService.Delete(alertRuleCacheKey(orgID, ngmodels.RuleTypeFilterRecording))
	st.CacheService.Delete(alertRuleCacheKey(orgID, ngmodels.RuleTypeFilterAll))

	st.Logger.Debug("Invalidated alert rules cache", "org_id", orgID)
}
