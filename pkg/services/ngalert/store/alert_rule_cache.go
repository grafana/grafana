package store

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// AlertRuleCacheTTL defines how long to cache alert rules (5 minutes)
	// Since we invalidate on CUD operations, we can afford a longer TTL
	AlertRuleCacheTTL = 5 * time.Minute
)

// AlertRuleCache is an abstraction for caching alert rules
type AlertRuleCache interface {
	// GetLiteRules retrieves cached lite rules for filtering
	GetLiteRules(ctx context.Context, orgID int64, ruleType ngmodels.RuleTypeFilter) ([]*ngmodels.AlertRuleLite, bool)

	// SetLiteRules stores lite rules in the cache
	SetLiteRules(ctx context.Context, orgID int64, ruleType ngmodels.RuleTypeFilter, rules []*ngmodels.AlertRuleLite) error

	// Delete invalidates all cached alert rules for an organization
	Delete(ctx context.Context, orgID int64) error
}

// localAlertRuleCache implements AlertRuleCache using in-memory local cache
type localAlertRuleCache struct {
	localCache *localcache.CacheService
	logger     log.Logger
}

// NewAlertRuleCache creates a new local cache implementation
func NewAlertRuleCache(cache *localcache.CacheService, logger log.Logger) AlertRuleCache {
	return &localAlertRuleCache{
		localCache: cache,
		logger:     logger,
	}
}

// ProvideAlertRuleCache provides the alert rule cache for wire dependency injection.
// Signature kept compatible with enterprise wire that passed cfg and remote cache; we ignore them.
func ProvideAlertRuleCache(cfg *setting.Cfg, cache *localcache.CacheService, _ remotecache.CacheStorage) AlertRuleCache {
	return NewAlertRuleCache(cache, log.New("ngalert.cache"))
}

func (c *localAlertRuleCache) GetLiteRules(ctx context.Context, orgID int64, ruleType ngmodels.RuleTypeFilter) ([]*ngmodels.AlertRuleLite, bool) {
	if c.localCache == nil {
		return nil, false
	}

	key := alertRuleCacheKey(orgID, ruleType)
	cached, found := c.localCache.Get(key)
	if !found {
		return nil, false
	}

	liteRules, ok := cached.([]*ngmodels.AlertRuleLite)
	if !ok {
		// Cache corruption - invalidate
		c.localCache.Delete(key)
		return nil, false
	}

	return liteRules, true
}

func (c *localAlertRuleCache) SetLiteRules(ctx context.Context, orgID int64, ruleType ngmodels.RuleTypeFilter, rules []*ngmodels.AlertRuleLite) error {
	if c.localCache == nil {
		return nil
	}

	key := alertRuleCacheKey(orgID, ruleType)
	c.localCache.Set(key, rules, AlertRuleCacheTTL)

	return nil
}

func (c *localAlertRuleCache) Delete(ctx context.Context, orgID int64) error {
	if c.localCache == nil {
		return nil
	}

	// Invalidate all rule type caches for the org
	c.localCache.Delete(alertRuleCacheKey(orgID, ngmodels.RuleTypeFilterAlerting))
	c.localCache.Delete(alertRuleCacheKey(orgID, ngmodels.RuleTypeFilterRecording))
	c.localCache.Delete(alertRuleCacheKey(orgID, ngmodels.RuleTypeFilterAll))

	return nil
}

// alertRuleCacheKey generates a cache key for alert rules based on orgID and rule type
func alertRuleCacheKey(orgID int64, ruleType ngmodels.RuleTypeFilter) string {
	return fmt.Sprintf("alert-rules:%d:%s", orgID, ruleType)
}

// getCachedLiteRules retrieves cached lite rules for an organization and rule type
func (st *DBstore) getCachedLiteRules(orgID int64, ruleType ngmodels.RuleTypeFilter) ([]*ngmodels.AlertRuleLite, bool) {
	if st.AlertRuleCache == nil {
		return nil, false
	}

	return st.AlertRuleCache.GetLiteRules(context.Background(), orgID, ruleType)
}

// setCachedLiteRules stores lite rules in the cache for an organization and rule type
func (st *DBstore) setCachedLiteRules(orgID int64, ruleType ngmodels.RuleTypeFilter, rules []*ngmodels.AlertRuleLite) {
	if st.AlertRuleCache == nil {
		return
	}

	_ = st.AlertRuleCache.SetLiteRules(context.Background(), orgID, ruleType, rules)
}

// invalidateAlertRulesCache invalidates all cached alert rules for an organization
// This is called when rules are created, updated, or deleted
func (st *DBstore) invalidateAlertRulesCache(orgID int64) {
	if st.AlertRuleCache == nil {
		return
	}

	_ = st.AlertRuleCache.Delete(context.Background(), orgID)
	st.Logger.Debug("Invalidated alert rules cache", "org_id", orgID)
}
