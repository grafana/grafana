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
		c.logger.Warn("GetLiteRules called but remoteCache is nil - cache unavailable")
		return nil, false
	}

	key := fmt.Sprintf("alert_rules:org:%d:lite", orgID)
	compressedData, err := c.remoteCache.Get(ctx, key)
	if err != nil {
		if err == remotecache.ErrCacheItemNotFound {
			c.logger.Debug("Lite rules not found in cache (cache miss)", "orgID", orgID)
			return nil, false
		}
		c.logger.Error("Failed to get lite rules from remote cache - Redis connection issue?",
			"error", err,
			"key", key,
			"orgID", orgID,
			"error_type", fmt.Sprintf("%T", err))
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
		c.logger.Error("Cache corruption detected: Failed to decompress lite rules - data truncated or incomplete",
			"error", err,
			"key", key,
			"orgID", orgID,
			"compressed_size_bytes", len(compressedData),
			"action", "deleting corrupted cache entry")
		if delErr := c.remoteCache.Delete(ctx, key); delErr != nil {
			c.logger.Warn("Failed to delete corrupted cache entry", "error", delErr, "key", key)
		} else {
			c.logger.Info("Deleted corrupted cache entry - will reload from database", "key", key, "orgID", orgID)
		}
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
	c.logger.Debug("Setting lite rules in Redis",
		"orgID", orgID,
		"uncompressed_bytes", len(liteMsgpack),
		"compressed_bytes", len(liteCompressed),
		"compression_ratio", float64(len(liteMsgpack))/float64(max(len(liteCompressed), 1)))

	if err := c.remoteCache.Set(ctx, liteKey, liteCompressed, AlertRuleCacheTTL); err != nil {
		c.logger.Error("Failed to SET lite rules in Redis - connection issue?",
			"error", err,
			"orgID", orgID,
			"key", liteKey,
			"size_bytes", len(liteCompressed),
			"error_type", fmt.Sprintf("%T", err))
		return fmt.Errorf("failed to cache lite rules in Redis: %w", err)
	}

	// Verify the write by reading back the size
	verifyData, verifyErr := c.remoteCache.Get(ctx, liteKey)
	if verifyErr != nil {
		c.logger.Warn("Failed to verify lite rules write to Redis",
			"error", verifyErr,
			"orgID", orgID,
			"expected_size", len(liteCompressed))
	} else if len(verifyData) != len(liteCompressed) {
		c.logger.Error("Redis write corruption detected: Size mismatch after SET",
			"orgID", orgID,
			"expected_size", len(liteCompressed),
			"actual_size", len(verifyData),
			"key", liteKey)
		// Delete corrupted entry
		_ = c.remoteCache.Delete(ctx, liteKey)
		return fmt.Errorf("redis write corruption: expected %d bytes, got %d bytes", len(liteCompressed), len(verifyData))
	} else {
		c.logger.Debug("Verified lite rules write to Redis", "orgID", orgID, "size_bytes", len(verifyData))
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
			c.logger.Warn("Failed to SET full rule in Redis",
				"uid", rule.UID,
				"error", err,
				"orgID", orgID,
				"key", fullKey,
				"size_bytes", len(fullMsgpack),
				"error_type", fmt.Sprintf("%T", err))
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
