package store

import (
	"context"
	"fmt"
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
// 1. Individual lite rules per UID (fetched with MGET for filtering)
// 2. Individual full rules per UID (fetched with MGET after filtering)
type AlertRuleCache interface {
	// GetLiteRules retrieves all cached lite alert rules for an organization
	// For remote cache, this uses MGET to fetch all lite rules efficiently
	GetLiteRules(ctx context.Context, orgID int64) ([]*ngmodels.AlertRuleLite, bool)

	// GetFullRules retrieves specific full rules by their UIDs (uses MGET for remote cache)
	GetFullRules(ctx context.Context, orgID int64, uids []string) (map[string]*ngmodels.AlertRule, error)

	// SetRules stores both lite and full rules in the cache
	// Both lite and full rules are stored individually per UID to avoid Redis size limits
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
		c.logger.Warn("GetLiteRules called but remoteCache is nil - cache unavailable")
		return nil, false
	}

	// First, get the index of UIDs for this org
	indexKey := fmt.Sprintf("alert_rules:org:%d:index", orgID)
	indexData, err := c.remoteCache.Get(ctx, indexKey)
	if err != nil {
		if err == remotecache.ErrCacheItemNotFound {
			c.logger.Debug("Lite rules index not found in cache (cache miss)", "orgID", orgID)
			return nil, false
		}
		c.logger.Error("Failed to get lite rules index from remote cache",
			"error", err,
			"key", indexKey,
			"orgID", orgID)
		return nil, false
	}

	// Unmarshal the UID index
	var uids []string
	if err := msgpack.Unmarshal(indexData, &uids); err != nil {
		c.logger.Error("Failed to unmarshal lite rules index", "error", err, "key", indexKey)
		_ = c.remoteCache.Delete(ctx, indexKey)
		return nil, false
	}

	if len(uids) == 0 {
		c.logger.Debug("Lite rules index is empty", "orgID", orgID)
		return []*ngmodels.AlertRuleLite{}, true
	}

	c.logger.Debug("Retrieved lite rules index", "orgID", orgID, "uid_count", len(uids))

	// Build keys for MGET to fetch all lite rules
	keys := make([]string, len(uids))
	for i, uid := range uids {
		keys[i] = fmt.Sprintf("alert_rule:org:%d:uid:%s:lite", orgID, uid)
	}

	startMget := time.Now()
	var rawValues [][]byte

	// Batch MGET for large datasets
	const mgetBatchSize = 10000
	if len(keys) <= mgetBatchSize {
		rawValues, err = c.remoteCache.MGet(ctx, keys...)
		if err != nil {
			c.logger.Error("Failed to MGET lite rules from Redis", "error", err, "count", len(keys))
			return nil, false
		}
	} else {
		c.logger.Info("Batching large MGET operation for lite rules", "total_keys", len(keys), "batch_size", mgetBatchSize)
		rawValues = make([][]byte, 0, len(keys))
		for i := 0; i < len(keys); i += mgetBatchSize {
			end := i + mgetBatchSize
			if end > len(keys) {
				end = len(keys)
			}
			batchKeys := keys[i:end]
			batchValues, err := c.remoteCache.MGet(ctx, batchKeys...)
			if err != nil {
				c.logger.Error("Failed to MGET lite batch from Redis", "error", err,
					"batch_start", i, "batch_size", len(batchKeys))
				return nil, false
			}
			rawValues = append(rawValues, batchValues...)
		}
	}
	mgetDuration := time.Since(startMget)

	// Unmarshal lite rules in parallel
	startUnmarshal := time.Now()
	results := make([]*ngmodels.AlertRuleLite, len(rawValues))

	workerCount := runtime.NumCPU() * 2
	if workerCount > 64 {
		workerCount = 64
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

	// Start workers
	for w := 0; w < workerCount; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for it := range ch {
				if it.data == nil {
					continue
				}
				var liteRule ngmodels.AlertRuleLite
				if err := msgpack.Unmarshal(it.data, &liteRule); err != nil {
					// skip malformed entries
					continue
				}
				results[it.index] = &liteRule
			}
		}()
	}

	// Feed data to workers
	for i, val := range rawValues {
		ch <- item{index: i, data: val}
	}
	close(ch)
	wg.Wait()

	// Build result slice, filtering out nil entries
	liteRules := make([]*ngmodels.AlertRuleLite, 0, len(results))
	for _, r := range results {
		if r != nil {
			liteRules = append(liteRules, r)
		}
	}
	unmarshalDuration := time.Since(startUnmarshal)

	c.logger.Info("Retrieved lite rules from cache via MGET",
		"orgID", orgID,
		"requested", len(uids),
		"found", len(liteRules),
		"mget_ms", mgetDuration.Milliseconds(),
		"unmarshal_ms", unmarshalDuration.Milliseconds(),
		"workers", workerCount)

	return liteRules, true
}

func (c *remoteAlertRuleCache) GetFullRules(ctx context.Context, orgID int64, uids []string) (map[string]*ngmodels.AlertRule, error) {
	if c.remoteCache == nil || len(uids) == 0 {
		return make(map[string]*ngmodels.AlertRule), nil
	}

	c.logger.Debug("GetFullRules called", "orgID", orgID, "uids_count", len(uids))

	// Build keys for MGET
	keys := make([]string, len(uids))
	for i, uid := range uids {
		keys[i] = fmt.Sprintf("alert_rule:org:%d:uid:%s", orgID, uid)
	}

	c.logger.Debug("Starting MGET", "keys_count", len(keys))
	startMget := time.Now()
	var rawValues [][]byte
	var err error

	// For very large MGET operations, batch them to avoid Redis timeouts
	// Most Redis setups can handle 10k+ keys in one MGET, but we batch anyway for safety
	const mgetBatchSize = 10000
	if len(keys) <= mgetBatchSize {
		// Single MGET for normal sizes
		rawValues, err = c.remoteCache.MGet(ctx, keys...)
		if err != nil {
			c.logger.Error("Failed to MGET full rules from Redis", "error", err, "count", len(keys))
			// Return empty map instead of error to allow fallback to DB
			return make(map[string]*ngmodels.AlertRule), nil
		}
	} else {
		// Batch MGET for very large sets
		c.logger.Info("Batching large MGET operation", "total_keys", len(keys), "batch_size", mgetBatchSize)
		rawValues = make([][]byte, 0, len(keys))
		for i := 0; i < len(keys); i += mgetBatchSize {
			end := i + mgetBatchSize
			if end > len(keys) {
				end = len(keys)
			}
			batchKeys := keys[i:end]
			batchValues, err := c.remoteCache.MGet(ctx, batchKeys...)
			if err != nil {
				c.logger.Error("Failed to MGET batch from Redis", "error", err,
					"batch_start", i, "batch_size", len(batchKeys))
				// Return empty map instead of error to allow fallback to DB
				return make(map[string]*ngmodels.AlertRule), nil
			}
			rawValues = append(rawValues, batchValues...)
		}
	}
	mgetDuration := time.Since(startMget)
	c.logger.Debug("MGET completed", "duration_ms", mgetDuration.Milliseconds(), "values_count", len(rawValues))

	// Unmarshal each rule in parallel (no gzip for per-item to reduce CPU)
	startUnmarshal := time.Now()
	c.logger.Debug("Starting parallel unmarshal", "values_count", len(rawValues))
	results := make([]*ngmodels.AlertRule, len(rawValues))

	// Optimize worker count based on workload size and CPU count
	// For large datasets (200k rules), we want more parallelism
	workerCount := runtime.NumCPU() * 4 // Increased from 2x to 4x
	if workerCount > 128 {              // Increased cap from 32 to 128
		workerCount = 128
	}
	if workerCount > len(rawValues) {
		workerCount = len(rawValues)
	}

	// Use buffered channel sized to minimize blocking
	// Larger buffer = producer (main goroutine) can feed data faster
	bufferSize := workerCount * 4 // Increased from 2x to 4x
	if bufferSize > 1000 {
		bufferSize = 1000 // Cap to avoid excessive memory
	}

	type item struct {
		index int
		data  []byte
	}
	ch := make(chan item, bufferSize)
	var wg sync.WaitGroup

	// Start workers
	for w := 0; w < workerCount; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			// Process items until channel is closed
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

	// Feed data to workers
	// This happens concurrently with workers unmarshaling
	for i, val := range rawValues {
		ch <- item{index: i, data: val}
	}
	close(ch)
	c.logger.Debug("Channel closed, waiting for workers")
	wg.Wait()
	c.logger.Debug("All workers completed")

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
		"total_ms", (mgetDuration + unmarshalDuration).Milliseconds(),
		"workers", workerCount,
		"avg_unmarshal_us", unmarshalDuration.Microseconds()/int64(max(len(rawValues), 1)))

	return result, nil
}

func (c *remoteAlertRuleCache) SetRules(ctx context.Context, orgID int64, rules ngmodels.RulesGroup) error {
	if c.remoteCache == nil {
		c.logger.Warn("SetRules called but remoteCache is nil - cannot cache rules", "orgID", orgID, "rule_count", len(rules))
		return nil
	}

	c.logger.Debug("SetRules starting", "orgID", orgID, "rule_count", len(rules))
	start := time.Now()

	// Build UID index for this org
	uids := make([]string, len(rules))
	for i, rule := range rules {
		uids[i] = rule.UID
	}

	// Store the UID index
	indexKey := fmt.Sprintf("alert_rules:org:%d:index", orgID)
	indexData, err := msgpack.Marshal(uids)
	if err != nil {
		return fmt.Errorf("failed to marshal UID index: %w", err)
	}

	if err := c.remoteCache.Set(ctx, indexKey, indexData, AlertRuleCacheTTL); err != nil {
		c.logger.Error("Failed to SET UID index in Redis",
			"error", err,
			"orgID", orgID,
			"key", indexKey)
		return fmt.Errorf("failed to cache UID index: %w", err)
	}

	// Store each lite and full rule individually
	totalLiteSize := 0
	totalFullSize := 0
	liteErrors := 0
	fullErrors := 0

	for _, rule := range rules {
		// 1. Marshal and store lite rule
		liteRule := rule.ToLite()
		liteMsgpack, err := msgpack.Marshal(liteRule)
		if err != nil {
			c.logger.Warn("Failed to marshal lite rule", "uid", rule.UID, "error", err)
			liteErrors++
			continue
		}
		totalLiteSize += len(liteMsgpack)

		liteKey := fmt.Sprintf("alert_rule:org:%d:uid:%s:lite", orgID, rule.UID)
		if err := c.remoteCache.Set(ctx, liteKey, liteMsgpack, AlertRuleCacheTTL); err != nil {
			c.logger.Warn("Failed to SET lite rule in Redis",
				"uid", rule.UID,
				"error", err,
				"orgID", orgID,
				"key", liteKey,
				"size_bytes", len(liteMsgpack))
			liteErrors++
		}

		// 2. Marshal and store full rule
		fullMsgpack, err := msgpack.Marshal(rule)
		if err != nil {
			c.logger.Warn("Failed to marshal full rule", "uid", rule.UID, "error", err)
			fullErrors++
			continue
		}
		totalFullSize += len(fullMsgpack)

		fullKey := fmt.Sprintf("alert_rule:org:%d:uid:%s", orgID, rule.UID)
		if err := c.remoteCache.Set(ctx, fullKey, fullMsgpack, AlertRuleCacheTTL); err != nil {
			c.logger.Warn("Failed to SET full rule in Redis",
				"uid", rule.UID,
				"error", err,
				"orgID", orgID,
				"key", fullKey,
				"size_bytes", len(fullMsgpack))
			fullErrors++
		}
	}

	duration := time.Since(start)
	c.logger.Info("Cached rules in Redis (individual keys)",
		"rule_count", len(rules),
		"lite_size_kb", totalLiteSize/1024,
		"full_size_kb", totalFullSize/1024,
		"lite_errors", liteErrors,
		"full_errors", fullErrors,
		"duration_ms", duration.Milliseconds())

	return nil
}

func (c *remoteAlertRuleCache) Delete(ctx context.Context, orgID int64) error {
	if c.remoteCache == nil {
		return nil
	}

	// Delete the UID index
	indexKey := fmt.Sprintf("alert_rules:org:%d:index", orgID)
	if err := c.remoteCache.Delete(ctx, indexKey); err != nil {
		c.logger.Error("Failed to delete UID index from cache", "error", err, "key", indexKey)
		return err
	}

	// Note: Individual lite and full rule keys will expire via TTL
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
