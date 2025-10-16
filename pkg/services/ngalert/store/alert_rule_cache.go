package store

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"runtime"
	"sync"
	"time"

	"github.com/vmihailenco/msgpack/v5"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	// AlertRuleCacheTTL defines how long to cache alert rules (5 minutes)
	// Since we invalidate on CUD operations, we can afford a longer TTL
	AlertRuleCacheTTL = 5 * time.Minute
)

// AlertRuleCache is an abstraction for caching alert rules using a two-tier approach:
// 1. All lite rules in one key (for fast filtering)
// 2. Individual full rules in separate keys (fetched with MGET after filtering)
type AlertRuleCache interface {
	// GetLiteRules retrieves all cached lite alert rules for an organization
	GetLiteRules(ctx context.Context, orgID int64) ([]*ngmodels.AlertRuleLite, bool)

	// GetFullRules retrieves specific full rules by their UIDs (uses MGET for remote cache)
	GetFullRules(ctx context.Context, orgID int64, uids []string) (map[string]*ngmodels.AlertRule, error)

	// SetRules stores both lite and full rules in the cache
	// Lite rules go in one key, full rules go in individual keys per UID
	SetRules(ctx context.Context, orgID int64, rules ngmodels.RulesGroup) error

	// Delete invalidates all cached alert rules for an organization (both lite and full)
	Delete(ctx context.Context, orgID int64) error
}

// localAlertRuleCache implements AlertRuleCache using in-memory local cache
type localAlertRuleCache struct {
	localCache *localcache.CacheService
	logger     log.Logger
}

// NewLocalAlertRuleCache creates a new local cache implementation
func NewLocalAlertRuleCache(cache *localcache.CacheService, logger log.Logger) AlertRuleCache {
	return &localAlertRuleCache{
		localCache: cache,
		logger:     logger,
	}
}

func (c *localAlertRuleCache) GetLiteRules(ctx context.Context, orgID int64) ([]*ngmodels.AlertRuleLite, bool) {
	if c.localCache == nil {
		return nil, false
	}

	key := fmt.Sprintf("alert_rules:org:%d:lite", orgID)
	cached, found := c.localCache.Get(key)
	if !found {
		return nil, false
	}

	rules, ok := cached.([]*ngmodels.AlertRuleLite)
	if !ok {
		// Cache corruption - invalidate
		c.localCache.Delete(key)
		return nil, false
	}

	return rules, true
}

func (c *localAlertRuleCache) GetFullRules(ctx context.Context, orgID int64, uids []string) (map[string]*ngmodels.AlertRule, error) {
	if c.localCache == nil {
		return nil, nil
	}

	result := make(map[string]*ngmodels.AlertRule, len(uids))
	for _, uid := range uids {
		key := fmt.Sprintf("alert_rule:org:%d:uid:%s", orgID, uid)
		if cached, found := c.localCache.Get(key); found {
			if rule, ok := cached.(*ngmodels.AlertRule); ok {
				result[uid] = rule
			}
		}
	}

	return result, nil
}

func (c *localAlertRuleCache) SetRules(ctx context.Context, orgID int64, rules ngmodels.RulesGroup) error {
	if c.localCache == nil {
		return nil
	}

	// Store lite rules in one key
	liteRules := make([]*ngmodels.AlertRuleLite, len(rules))
	for i, rule := range rules {
		liteRules[i] = rule.ToLite()

		// Store each full rule in its own key
		fullKey := fmt.Sprintf("alert_rule:org:%d:uid:%s", orgID, rule.UID)
		c.localCache.Set(fullKey, rule, AlertRuleCacheTTL)
	}

	liteKey := fmt.Sprintf("alert_rules:org:%d:lite", orgID)
	c.localCache.Set(liteKey, liteRules, AlertRuleCacheTTL)

	return nil
}

func (c *localAlertRuleCache) Delete(ctx context.Context, orgID int64) error {
	if c.localCache == nil {
		return nil
	}

	// Delete lite rules key
	liteKey := fmt.Sprintf("alert_rules:org:%d:lite", orgID)
	c.localCache.Delete(liteKey)

	// Note: Individual full rule keys will expire naturally via TTL
	// For complete cleanup, we'd need to track all UIDs, but that's complex
	// TTL-based expiry is simpler and sufficient

	return nil
}

// remoteAlertRuleCache implements AlertRuleCache using remote cache (Redis)
// Note: This implementation requires Redis and uses MGET for efficient bulk fetches
type remoteAlertRuleCache struct {
	remoteCache remotecache.CacheStorage
	logger      log.Logger
}

// NewRemoteAlertRuleCache creates a new remote cache implementation
func NewRemoteAlertRuleCache(cache remotecache.CacheStorage, logger log.Logger) AlertRuleCache {
	return &remoteAlertRuleCache{
		remoteCache: cache,
		logger:      logger,
	}
}

func (c *remoteAlertRuleCache) GetLiteRules(ctx context.Context, orgID int64) ([]*ngmodels.AlertRuleLite, bool) {
	if c.remoteCache == nil {
		return nil, false
	}

	key := fmt.Sprintf("alert_rules:org:%d:lite", orgID)
	compressedData, err := c.remoteCache.Get(ctx, key)
	if err != nil {
		if err == remotecache.ErrCacheItemNotFound {
			return nil, false
		}
		c.logger.Error("Failed to get lite rules from remote cache", "error", err, "key", key)
		return nil, false
	}

	// Decompress the data
	gr, err := gzip.NewReader(bytes.NewReader(compressedData))
	if err != nil {
		c.logger.Error("Failed to create gzip reader for lite rules", "error", err, "key", key)
		_ = c.remoteCache.Delete(ctx, key)
		return nil, false
	}
	defer gr.Close()

	data, err := io.ReadAll(gr)
	if err != nil {
		c.logger.Error("Failed to decompress lite rules from cache", "error", err, "key", key)
		_ = c.remoteCache.Delete(ctx, key)
		return nil, false
	}

	var rules []*ngmodels.AlertRuleLite
	if err := msgpack.Unmarshal(data, &rules); err != nil {
		c.logger.Error("Failed to unmarshal lite rules from cache", "error", err, "key", key)
		// Cache corruption - invalidate
		_ = c.remoteCache.Delete(ctx, key)
		return nil, false
	}

	c.logger.Info("Retrieved lite rules from cache", "orgID", orgID, "count", len(rules))
	return rules, true
}

func (c *remoteAlertRuleCache) GetFullRules(ctx context.Context, orgID int64, uids []string) (map[string]*ngmodels.AlertRule, error) {
	if c.remoteCache == nil || len(uids) == 0 {
		return make(map[string]*ngmodels.AlertRule), nil
	}

	// Build keys for MGET
	keys := make([]string, len(uids))
	for i, uid := range uids {
		keys[i] = fmt.Sprintf("alert_rule:org:%d:uid:%s", orgID, uid)
	}

	// Fetch all full rules with one Redis MGET operation
	startMget := time.Now()
	rawValues, err := c.remoteCache.MGet(ctx, keys...)
	if err != nil {
		c.logger.Error("Failed to MGET full rules from Redis", "error", err, "count", len(keys))
		return nil, err
	}
	mgetDuration := time.Since(startMget)

	// Unmarshal each rule in parallel (no gzip for per-item to reduce CPU)
	startUnmarshal := time.Now()
	results := make([]*ngmodels.AlertRule, len(rawValues))

	workerCount := runtime.NumCPU() * 2
	if workerCount > 32 {
		workerCount = 32
	}
	if workerCount > len(rawValues) {
		workerCount = len(rawValues)
	}

	type item struct {
		index int
		data  []byte
	}
	ch := make(chan item, workerCount*2)
	var wg sync.WaitGroup

	for w := 0; w < workerCount; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for it := range ch {
				if it.data == nil {
					continue
				}
				var rule ngmodels.AlertRule
				if err := msgpack.Unmarshal(it.data, &rule); err != nil {
					// skip malformed entries
					continue
				}
				results[it.index] = &rule
			}
		}()
	}

	for i, val := range rawValues {
		ch <- item{index: i, data: val}
	}
	close(ch)
	wg.Wait()

	// Build result map maintaining requested order
	result := make(map[string]*ngmodels.AlertRule, len(uids))
	found := 0
	for i, r := range results {
		if r != nil {
			result[uids[i]] = r
			found++
		}
	}
	unmarshalDuration := time.Since(startUnmarshal)

	c.logger.Info("MGET full rules from cache",
		"requested", len(uids),
		"found", found,
		"mget_ms", mgetDuration.Milliseconds(),
		"unmarshal_ms", unmarshalDuration.Milliseconds(),
		"workers", workerCount)

	return result, nil
}

func (c *remoteAlertRuleCache) SetRules(ctx context.Context, orgID int64, rules ngmodels.RulesGroup) error {
	if c.remoteCache == nil {
		return nil
	}

	start := time.Now()

	// 1. Create and cache lite rules in one key
	liteRules := make([]*ngmodels.AlertRuleLite, len(rules))
	for i, rule := range rules {
		liteRules[i] = rule.ToLite()
	}

	// Marshal and compress lite rules
	liteMsgpack, err := msgpack.Marshal(liteRules)
	if err != nil {
		return fmt.Errorf("failed to marshal lite rules: %w", err)
	}

	var liteBuf bytes.Buffer
	liteGw := gzip.NewWriter(&liteBuf)
	if _, err := liteGw.Write(liteMsgpack); err != nil {
		return fmt.Errorf("failed to compress lite rules: %w", err)
	}
	liteGw.Close()
	liteCompressed := liteBuf.Bytes()

	// Store lite rules
	liteKey := fmt.Sprintf("alert_rules:org:%d:lite", orgID)
	if err := c.remoteCache.Set(ctx, liteKey, liteCompressed, AlertRuleCacheTTL); err != nil {
		return fmt.Errorf("failed to cache lite rules: %w", err)
	}

	// 2. Cache each full rule individually (msgpack only for per-item for faster decode)
	totalFullSize := 0
	for _, rule := range rules {
		// Marshal each rule
		fullMsgpack, err := msgpack.Marshal(rule)
		if err != nil {
			c.logger.Warn("Failed to marshal full rule", "uid", rule.UID, "error", err)
			continue
		}
		totalFullSize += len(fullMsgpack)

		// Store full rule (no gzip)
		fullKey := fmt.Sprintf("alert_rule:org:%d:uid:%s", orgID, rule.UID)
		if err := c.remoteCache.Set(ctx, fullKey, fullMsgpack, AlertRuleCacheTTL); err != nil {
			c.logger.Warn("Failed to cache full rule", "uid", rule.UID, "error", err)
		}
	}

	duration := time.Since(start)
	c.logger.Info("Cached rules in Redis",
		"rule_count", len(rules),
		"lite_size_mb", len(liteMsgpack)/(1024*1024),
		"lite_compressed_mb", len(liteCompressed)/(1024*1024),
		"full_size_mb", totalFullSize/(1024*1024),
		"duration_ms", duration.Milliseconds())

	return nil
}

func (c *remoteAlertRuleCache) Delete(ctx context.Context, orgID int64) error {
	if c.remoteCache == nil {
		return nil
	}

	// Delete lite rules key
	liteKey := fmt.Sprintf("alert_rules:org:%d:lite", orgID)
	if err := c.remoteCache.Delete(ctx, liteKey); err != nil {
		c.logger.Error("Failed to delete lite rules from cache", "error", err, "key", liteKey)
		return err
	}

	// Note: Individual full rule keys will expire via TTL
	// For complete cleanup, we'd need to scan keys with pattern alert_rule:org:N:uid:*
	// but that's expensive. TTL-based expiry is sufficient.

	return nil
}

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

// getCachedAlertRulesFiltered retrieves rules from cache using lite filtering + MGET hydration
// Returns (rules, true) on cache hit, or (nil, false) if cache is unavailable/miss or filters unsupported
func (st *DBstore) getCachedAlertRulesFiltered(ctx context.Context, query *ngmodels.ListAlertRulesExtendedQuery) (ngmodels.RulesGroup, bool) {
	if st.AlertRuleCache == nil {
		return nil, false
	}
	// Some filters require full rule data (e.g., datasource filters). Bypass cache for those
	if len(query.DatasourceUIDs) > 0 {
		return nil, false
	}

	start := time.Now()
	liteRules, found := st.AlertRuleCache.GetLiteRules(ctx, query.OrgID)
	if !found || liteRules == nil {
		if collector := getTimingCollectorFromContext(ctx); collector != nil {
			collector.RecordCacheMiss(time.Since(start))
		}
		return nil, false
	}

	// Filter lite rules
	uids := filterLiteRuleUIDs(liteRules, query)
	if len(uids) == 0 {
		if collector := getTimingCollectorFromContext(ctx); collector != nil {
			collector.RecordCacheHit(time.Since(start))
		}
		return make([]*ngmodels.AlertRule, 0), true
	}

	// Hydrate full rules via MGET
	fullMap, err := st.AlertRuleCache.GetFullRules(ctx, query.OrgID, uids)
	if err != nil {
		st.Logger.Warn("Failed to MGET full rules from cache, bypassing cache", "error", err)
		return nil, false
	}

	// Build result slice in same order as filtered UIDs
	result := make([]*ngmodels.AlertRule, 0, len(fullMap))
	for _, uid := range uids {
		if rule, ok := fullMap[uid]; ok && rule != nil {
			// Optional: filter by RuleType here (alerting/recording) using rule.Record
			if query.RuleType == ngmodels.RuleTypeFilterRecording && rule.Record == nil {
				continue
			}
			if query.RuleType == ngmodels.RuleTypeFilterAlerting && rule.Record != nil {
				continue
			}
			result = append(result, rule)
		}
	}

	if collector := getTimingCollectorFromContext(ctx); collector != nil {
		collector.RecordCacheHit(time.Since(start))
	}
	st.Logger.Info("Cache hit (lite+MGET)", "org_id", query.OrgID, "lite_count", len(liteRules), "uids", len(uids), "result", len(result))
	return result, true
}

// setCachedAlertRules stores alert rules in the cache for an organization
// This caches both lite rules (for filtering) and full rules (for final result)
func (st *DBstore) setCachedAlertRules(orgID int64, ruleType ngmodels.RuleTypeFilter, rules ngmodels.RulesGroup) {
	if st.AlertRuleCache == nil {
		return
	}

	start := time.Now()
	if err := st.AlertRuleCache.SetRules(context.Background(), orgID, rules); err != nil {
		st.Logger.Error("Failed to cache alert rules", "org_id", orgID, "error", err)
		return
	}

	st.Logger.Info("Cached alert rules", "org_id", orgID, "rules_count", len(rules),
		"ttl", AlertRuleCacheTTL, "duration_ms", time.Since(start).Milliseconds())
}

// invalidateAlertRulesCache invalidates all cached alert rules for an organization
// This is called when rules are created, updated, or deleted
func (st *DBstore) invalidateAlertRulesCache(orgID int64) {
	if st.AlertRuleCache == nil {
		return
	}

	if err := st.AlertRuleCache.Delete(context.Background(), orgID); err != nil {
		st.Logger.Error("Failed to invalidate alert rules cache", "org_id", orgID, "error", err)
		return
	}

	st.Logger.Debug("Invalidated alert rules cache", "org_id", orgID)
}
