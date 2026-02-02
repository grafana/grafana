// BMC file
package pluginproxy

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"strings"

	"time"

	"github.com/golang/snappy"
	glog "github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/redis/go-redis/v9"

	"github.com/sony/gobreaker" // Circuit breaker for redis failure handling
)

var (
	redisClient         redis.UniversalClient
	redisVarCacheLogger = glog.New("data-proxy-log.redisvarcache")
	// We need to check for remoteVariableCaheSettings.Enabled before doing any redis server call/operation such as get, ping, set, etc
	remoteVariableCacheSettings *setting.RemoteVariableCacheSettings
	configSetToDisabledError    = errors.New("not performing operation since config is set to disabled")
	redisClusterModeEnabled     bool
	// Circuit breaker provides automatic failure detection and recovery
	redisCircuitBreaker *gobreaker.CircuitBreaker
	// Variable to capture counts when circuit is about to trip
	lastCounts gobreaker.Counts
)

const (
	// varc_{orgID:dashboardUID}:variableName:userID
	// Hash tags ensure all keys for the same dashboard are on the same Redis cluster slot
	dashboardQueryKeyFormat = "varc_{%v:%s}:"
	variableQueryKeyFormat  = dashboardQueryKeyFormat + "%s:"
	queryKeyFormat          = variableQueryKeyFormat + "%v" // "varc_{%v:%s}:%s:%v"
)

func InitRedisClient(remoteVariableCache *setting.RemoteVariableCacheSettings) {
	remoteVariableCacheSettings = remoteVariableCache
	if remoteVariableCache.Host == "" {
		redisVarCacheLogger.Error("missing addr in config")
		remoteVariableCacheSettings.Enabled = false
		return
	}
	addr := fmt.Sprintf("%s:%d", remoteVariableCache.Host, remoteVariableCache.Port)
	redisClusterModeEnabled = remoteVariableCache.RedisClusterModeEnabled
	var tlsConfig *tls.Config
	if remoteVariableCache.SSL != "" && remoteVariableCache.SSL != "true" && remoteVariableCache.SSL != "false" && remoteVariableCache.SSL != "insecure" {
		redisVarCacheLogger.Error("invalid SSL configuration value, must be 'true', 'false', or 'insecure'", "ssl", remoteVariableCache.SSL)
		remoteVariableCacheSettings.Enabled = false
		return
	}
	switch remoteVariableCache.SSL {
	case "true":
		// Extract hostname from address for proper certificate validation
		sp := strings.Split(addr, ":")
		if len(sp) < 1 || sp[0] == "" {
			redisVarCacheLogger.Error("unable to extract hostname from address for TLS configuration", "addr", addr)
			remoteVariableCacheSettings.Enabled = false
			return
		}
		tlsConfig = &tls.Config{
			ServerName: sp[0],
		}
		redisVarCacheLogger.Info("TLS enabled for Redis connection", "serverName", sp[0])
	case "insecure":
		// Enable TLS but skip certificate verification
		tlsConfig = &tls.Config{
			InsecureSkipVerify: true,
		}
		redisVarCacheLogger.Info("TLS enabled for Redis connection with InsecureSkipVerify")
	}
	// If SSL is "false" or empty, tlsConfig remains nil (no TLS)

	if redisClusterModeEnabled {
		redisClient = redis.NewClusterClient(&redis.ClusterOptions{
			Addrs:           []string{addr},
			Password:        remoteVariableCache.Password,
			PoolSize:        remoteVariableCache.PoolSize,
			ReadTimeout:     remoteVariableCache.ReadTimeout,
			WriteTimeout:    remoteVariableCache.WriteTimeout,
			TLSConfig:       tlsConfig,
			ConnMaxIdleTime: remoteVariableCache.ConnMaxIdleTime,
			MinIdleConns:    remoteVariableCache.MinIdleConns,
		})
	} else {
		redisClient = redis.NewClient(&redis.Options{
			Addr:            addr,
			Password:        remoteVariableCache.Password,
			DB:              remoteVariableCache.DB,
			PoolSize:        remoteVariableCache.PoolSize,
			ReadTimeout:     remoteVariableCache.ReadTimeout,
			WriteTimeout:    remoteVariableCache.WriteTimeout,
			TLSConfig:       tlsConfig,
			ConnMaxIdleTime: remoteVariableCache.ConnMaxIdleTime,
			MinIdleConns:    remoteVariableCache.MinIdleConns,
		})
	}

	// Circuit breaker state transitions and counter reset behavior:
	// 1. Closed → Open: Triggered by ReadyToTrip when failure thresholds exceeded (we log the counts)
	// 2. Open → Half-Open: After timeout expires (counters reset to 0 by gobreaker ReadytoTrip is not triggered)
	// 3. Half-Open → Closed: On success in half-open state (counters reset to 0 by gobreaker ReadytoTrip is not triggered)
	// 4. Half-Open → Open: On failure in half-open state (counters continue from half-open state)

	// gobreaker resets counters internally on transitions to Half-Open and Closed states,
	// but these reset values are not exposed in the OnStateChange callback
	redisCircuitBreaker = gobreaker.NewCircuitBreaker(gobreaker.Settings{
		Name:        "RedisVariableCache",
		MaxRequests: remoteVariableCache.CircuitBreakerMaxRequests,
		Interval:    remoteVariableCache.CircuitBreakerInterval,
		Timeout:     remoteVariableCache.CircuitBreakerTimeout,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			// Always capture counts for state change logging
			lastCounts = counts

			// Open circuit if:
			// - Configured consecutive failures threshold reached, OR
			// - Configured failure rate with minimum requests threshold reached
			failureRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			shouldTrip := counts.Requests >= remoteVariableCache.CircuitBreakerMinRequests &&
				(counts.ConsecutiveFailures >= remoteVariableCache.CircuitBreakerConsecutiveFailures || failureRatio >= remoteVariableCache.CircuitBreakerFailureRatio)

			return shouldTrip
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			redisVarCacheLogger.Info("redis circuit breaker state changed",
				"from", from.String(),
				"to", to.String())

			// Only log detailed metrics when circuit OPENS (transitions TO open state)
			if to == gobreaker.StateOpen && lastCounts.Requests > 0 {
				failureRatio := float64(lastCounts.TotalFailures) / float64(lastCounts.Requests)
				redisVarCacheLogger.Info("circuit breaker opened due to failures",
					"consecutive_failures", lastCounts.ConsecutiveFailures,
					"total_requests", lastCounts.Requests,
					"total_failures", lastCounts.TotalFailures,
					"total_successes", lastCounts.TotalSuccesses,
					"failure_ratio", fmt.Sprintf("%.2f%%", failureRatio*100),
				)
			}
		},
	})

	if remoteVariableCacheSettings.Enabled {
		_, err := redisClient.Ping(context.Background()).Result()
		if err != nil {
			// Error logging
			redisVarCacheLogger.Error("failed to ping Redis", "error", err, "redisClusterMode", redisClusterModeEnabled, "redisAddr", addr, "db", remoteVariableCache.DB)
		} else {
			// Success logging
			redisVarCacheLogger.Info("redis client initialized successfully", "redisClusterMode", redisClusterModeEnabled, "redisAddr", addr, "db", remoteVariableCache.DB)
		}
	} else {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "operation", "ping")
	}
}

// When changing pattern, also change in DeleteDashboardCache and DeleteVariableCache

// For regular variables: parentValuesHash should be empty string, format: "varc_orgID:dashboardUID:variableName:userID"
// For cascading variables: parentValuesHash contains the parent values hash, format: "varc_orgID:dashboardUID:variableName:userID:{parentValuesHash}"
// The parent values hash is computed from parent variable values in the order they appear in the query
func GenerateQueryKey(orgID int64, dashboardUID string, variableName string, userID int64, parentValuesHash string) string {
	if parentValuesHash == "" {
		// Regular variable key (no dependencies)
		return fmt.Sprintf(queryKeyFormat, orgID, dashboardUID, variableName, userID)
	}
	// Cascading variable key (with parent values hash)
	return fmt.Sprintf(queryKeyFormat+":%s", orgID, dashboardUID, variableName, userID, parentValuesHash)
}

// handleCircuitBreakerError provides centralized error handling for circuit breaker operations
// operation: Redis command type (GET, SET, DEL, SCAN)
// contextFieldName: Name of the field being logged (queryKey, pattern, lengthOfQueryKeys)
// contextValue: Actual value to log (can be string, int, []string, etc.)
func handleCircuitBreakerError(err error, operation string, contextFieldName string, contextValue interface{}) {
	switch err {
	case gobreaker.ErrOpenState:
		redisVarCacheLogger.Info("circuit breaker open, skipping Redis", "operation", operation)
	case gobreaker.ErrTooManyRequests:
		redisVarCacheLogger.Info("circuit breaker too many requests", "operation", operation)
	default:
		// Create formatted error message
		errorMessage := fmt.Sprintf("redis %s error", strings.ToUpper(operation))
		// Log with operation-specific details
		redisVarCacheLogger.Error(errorMessage, contextFieldName, contextValue, "operation", operation, "error", err, "redisClusterMode", redisClusterModeEnabled)
	}
}

func GetFromCache(ctx context.Context, queryKey string) (string, bool) {
	if !remoteVariableCacheSettings.Enabled {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "queryKey", queryKey, "operation", "get")
		return "", false
	}

	result, err := redisCircuitBreaker.Execute(func() (interface{}, error) {
		val, err := redisClient.Get(ctx, queryKey).Bytes()
		// redis.Nil means key doesn't exist - this is a SUCCESSFUL Redis operation
		// Don't return it as an error to the circuit breaker, or it will think Redis is down
		if err == redis.Nil {
			return nil, nil // Return success with nil value
		}
		return val, err // Return actual errors (connection failed, timeout, etc.)
	})

	if err != nil {
		handleCircuitBreakerError(err, "get", "queryKey", queryKey)
		return "", false
	}

	// result is nil when key doesn't exist (redis.Nil case)
	if result == nil {
		redisVarCacheLogger.Info("no cache found for query key", "operation", "get", "queryKey", queryKey)
		return "", false
	}

	redisVarCacheLogger.Debug("redis cache hit", "key", queryKey)
	decompressedVal, decompressErr := snappyDecompress(result.([]byte))
	if decompressErr != nil {
		redisVarCacheLogger.Error("snappy decompression error", "queryKey", queryKey, "operation", "get", "err", decompressErr) //using redisVarCacheLogger instead of normal logger since this is a redis cache operation
		return "", false
	}
	return decompressedVal, true

}

func SetToCache(ctx context.Context, queryKey string, value []byte, duration time.Duration) {
	if !remoteVariableCacheSettings.Enabled {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "queryKey", queryKey, "operation", "set")
		return
	}

	compressedValue, err := snappyCompress(value)
	if err != nil {
		redisVarCacheLogger.Error("failed to compress data", "err", err, "operation", "set", "queryKey", queryKey)
		return
	}

	compressedValueLen := len(compressedValue)
	if compressedValueLen > remoteVariableCacheSettings.MaxResponseSize {
		redisVarCacheLogger.Error("compressed size exceeds max allowed",
			"compressedValueLen", compressedValueLen,
			"maxResponseSize", remoteVariableCacheSettings.MaxResponseSize,
			"queryKey", queryKey,
			"operation", "set")
		return
	}

	redisVarCacheLogger.Debug("setting cached value", "operation", "set", "queryKey", queryKey, "size", len(compressedValue))

	_, err = redisCircuitBreaker.Execute(func() (interface{}, error) {
		return nil, redisClient.Set(ctx, queryKey, compressedValue, duration).Err()
	})

	if err != nil {
		handleCircuitBreakerError(err, "set", "queryKey", queryKey)
	} else {
		redisVarCacheLogger.Info("cached value successfully stored", "operation", "set", "queryKey", queryKey)
	}
}

func DeleteFromCache(ctx context.Context, queryKeys []string) bool {
	if !remoteVariableCacheSettings.Enabled {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "lengthOfQueryKeys", len(queryKeys), "operation", "delete")
		return false
	}

	if len(queryKeys) == 0 {
		redisVarCacheLogger.Warn("cannot pass empty queryKeys array", "operation", "delete", "lengthOfQueryKeys", len(queryKeys))
		return false
	}

	redisVarCacheLogger.Debug("deleting cache", "lengthOfQueryKeys", len(queryKeys), "operation", "delete")

	_, err := redisCircuitBreaker.Execute(func() (interface{}, error) {
		return nil, redisClient.Del(ctx, queryKeys...).Err()
	})

	if err != nil {
		handleCircuitBreakerError(err, "del", "lengthOfQueryKeys", len(queryKeys))
		return false
	}

	redisVarCacheLogger.Info("cache deleted successfully", "lengthOfQueryKeys", len(queryKeys))
	return true
}

func GetMatchingKeys(ctx context.Context, pattern string) ([]string, error) {
	if !remoteVariableCacheSettings.Enabled {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "pattern", pattern, "operation", "scan")
		return nil, configSetToDisabledError
	}

	redisVarCacheLogger.Debug("scanning for pattern in redis cache", "pattern", pattern, "operation", "scan")

	result, err := redisCircuitBreaker.Execute(func() (interface{}, error) {
		// use a custom time out bigger than the usual readtimeout since scanning cannot finish so quickly for folders and dashboards
		timeoutCtx, cancel := context.WithTimeout(ctx, remoteVariableCacheSettings.ScanTimeout)
		defer cancel()

		var keys []string
		iter := redisClient.Scan(timeoutCtx, 0, pattern, remoteVariableCacheSettings.ScanCount).Iterator()

		// Iterate and collect all keys within circuit breaker protection
		for iter.Next(timeoutCtx) {
			keys = append(keys, iter.Val())
		}

		// Check for errors during iteration
		if err := iter.Err(); err != nil {
			redisVarCacheLogger.Error("redis SCAN iteration error", "pattern", pattern, "operation", "scan", "error", err)
			return nil, err
		}

		return keys, nil
	})
	if err != nil {
		handleCircuitBreakerError(err, "scan", "pattern", pattern)
		return nil, err
	}

	redisVarCacheLogger.Debug("scan completed", "pattern", pattern, "totalKeys", len(result.([]string)))
	return result.([]string), nil

}

// getAllMatchingKeysFromAllShards scans all shards in a Redis cluster to find matching keys
// Even with hashtags, we need to scan all shards to find which one contains our keys
func GetAllMatchingKeysFromAllShards(ctx context.Context, pattern string) ([]string, error) {
	if !remoteVariableCacheSettings.Enabled {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "pattern", pattern, "operation", "scan")
		return nil, configSetToDisabledError
	}

	redisVarCacheLogger.Debug("scanning all shards for pattern", "pattern", pattern, "operation", "scan")

	result, err := redisCircuitBreaker.Execute(func() (interface{}, error) {
		var allKeys []string

		clusterClient, ok := redisClient.(*redis.ClusterClient)
		if !ok {
			return nil, fmt.Errorf("expected ClusterClient but got different type")
		}

		// use a custom time out bigger than the usual readtimeout since scanning cannot finish so quickly for folders and dashboards
		timeoutCtx, cancel := context.WithTimeout(ctx, remoteVariableCacheSettings.ScanTimeout)
		defer cancel()

		// Iterate over all shards in the cluster
		err := clusterClient.ForEachShard(timeoutCtx, func(ctx context.Context, shard *redis.Client) error {
			var cursor uint64
			for {
				var keys []string
				var err error

				keys, cursor, err = shard.Scan(timeoutCtx, cursor, pattern, remoteVariableCacheSettings.ScanCount).Result()
				if err != nil {
					redisVarCacheLogger.Error("redis SCAN error on shard", "pattern", pattern, "operation", "scan", "error", err)
					return err
				}
				allKeys = append(allKeys, keys...)
				if cursor == 0 {
					break
				}
			}
			return nil
		})

		if err != nil {
			redisVarCacheLogger.Error("error scanning cluster shards", "pattern", pattern, "operation", "scan", "error", err)
			return nil, err
		}

		redisVarCacheLogger.Debug("scanned all cluster shards", "pattern", pattern, "totalKeys", len(allKeys))
		return allKeys, nil
	})

	if err != nil {
		handleCircuitBreakerError(err, "scan", "pattern", pattern)
		return nil, err
	}

	return result.([]string), nil
}

// extractHashTag extracts the hash tag from a Redis key pattern
// Hash tags are denoted by curly braces and used to ensure keys map to the same slot
// Examples:
//   - "{varc_1:abc123}:variable:user" -> "{varc_1:abc123}"
//   - "key_without_hashtag" -> ""
//   - "{tag}:*" -> "{tag}"
func ExtractHashTag(pattern string) string {
	start := strings.Index(pattern, "{")
	if start < 0 {
		// No opening brace found
		return ""
	}

	end := strings.Index(pattern[start+1:], "}")
	if end < 0 {
		// No closing brace found after opening brace
		return ""
	}

	// Return the hash tag including the braces
	// start points to '{', end is relative to start+1, so actual position is start+1+end
	hashTag := pattern[start : start+1+end+1]

	// Validate that hash tag is not empty (e.g., "{}")
	if len(hashTag) <= 2 {
		return ""
	}

	return hashTag
}

// getAllMatchingKeysFromCluster - using MasterForKey to find the right shard
func GetAllMatchingKeysFromCluster(ctx context.Context, pattern string) ([]string, error) {
	if !remoteVariableCacheSettings.Enabled {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "pattern", pattern, "operation", "scan")
		return nil, configSetToDisabledError
	}

	result, err := redisCircuitBreaker.Execute(func() (interface{}, error) {
		clusterClient, ok := redisClient.(*redis.ClusterClient)
		if !ok {
			return nil, fmt.Errorf("expected ClusterClient but got different type")
		}

		timeoutCtx, cancel := context.WithTimeout(ctx, remoteVariableCacheSettings.ScanTimeout)
		defer cancel()

		// Extract hash tag to get a sample key
		hashTag := ExtractHashTag(pattern)

		if hashTag != "" {
			// Use the hash tag as a sample key to find the right node
			// This works because all keys with this hash tag go to the same node
			masterClient, err := clusterClient.MasterForKey(timeoutCtx, hashTag)
			if err != nil {
				redisVarCacheLogger.Error("failed to get master for key", "hashTag", hashTag, "error", err)
				return nil, err
			}

			var allKeys []string
			var cursor uint64

			for {
				var keys []string
				var err error
				keys, cursor, err = masterClient.Scan(timeoutCtx, cursor, pattern, remoteVariableCacheSettings.ScanCount).Result()
				if err != nil {
					redisVarCacheLogger.Error("redis SCAN error", "pattern", pattern, "error", err)
					return nil, err
				}
				allKeys = append(allKeys, keys...)
				if cursor == 0 {
					break
				}
			}

			redisVarCacheLogger.Debug("scanned single shard", "pattern", pattern, "totalKeys", len(allKeys))
			return allKeys, nil
		}

		// Fallback: scan all shards if no hash tag
		// Note: This will NOT use circuit breaker again (already inside Execute)
		redisVarCacheLogger.Warn("no hash tag in pattern, scanning all shards", "pattern", pattern)
		return nil, fmt.Errorf("no hash tag found in pattern, cannot use getAllMatchingKeysFromCluster")
	})

	if err != nil {
		// If no hash tag, fallback to scanning all shards (this will use circuit breaker internally)
		if strings.Contains(err.Error(), "no hash tag found") {
			return GetAllMatchingKeysFromAllShards(ctx, pattern)
		}
		handleCircuitBreakerError(err, "scan", "pattern", pattern)
		return nil, err
	}

	return result.([]string), nil
}

// Delete all keys that match a given pattern. Always call this/parent function in a goroutine since it is iterating and blocking operation
// Call with empty/different context than request if calling in a go routine, since the request context is closed by the time this spins up a go routine and starts iterating
func DeleteMatchingKeys(ctx context.Context, pattern string) error {
	if remoteVariableCacheSettings.Enabled {
		var keys []string
		var err error

		// With hash tags, all keys for the same dashboard are on the same shard, but we still need to identify the shard and fetch keys from it
		if redisClusterModeEnabled {
			// In cluster mode, we need to scan mastershard for pattern keys
			redisVarCacheLogger.Debug("scanning cluster shard for pattern", "pattern", pattern, "operation", "scan")
			keys, err = GetAllMatchingKeysFromCluster(ctx, pattern)
			if err != nil {
				redisVarCacheLogger.Error("error in fetching keys from cluster", "pattern", pattern, "err", err)
				return err
			}
		} else {
			// In non-cluster mode, use the regular iterator
			keys, err = GetMatchingKeys(ctx, pattern)
			if err != nil {
				redisVarCacheLogger.Error("error in fetching keys", "pattern", pattern, "err", err)
				return err
			}
		}

		if len(keys) > 0 {
			DeleteFromCache(ctx, keys)
			redisVarCacheLogger.Info("variable cache cleared successfully", "pattern", pattern, "keysDeleted", len(keys))
		} else {
			redisVarCacheLogger.Info("no keys found matching pattern", "pattern", pattern)
		}
		return nil
	} else {
		redisVarCacheLogger.Error(configSetToDisabledError.Error(), "pattern", pattern, "operation", "deleteMatching")
		return configSetToDisabledError
	}
}

func isAllowedCharacter(stringToCheck string) bool {
	// Alphanumeric or '_'
	for _, r := range stringToCheck {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || (r == '_')) {
			return false
		}
	}
	return true
}

func isValidQuerySubStr(subStr string) bool {
	// do not allow empty string or stuff like *
	return (subStr != "" && isAllowedCharacter(subStr))
}

// Always call in a goroutine. we need to check feature flag status before calling this.
// External FF check + this call can be done in goroutine
// This has to be called with any dashboard delete flow
func DeleteDashboardCache(orgID int64, dashboardUID string) {
	ctx, cancel := context.WithTimeout(context.Background(), remoteVariableCacheSettings.BackgroundDeletionTimeout)
	defer cancel()
	// do not allow empty string or *
	if !isValidQuerySubStr(dashboardUID) {
		redisVarCacheLogger.Error("invalid dashboard uid provided for deletion of dashboard cache", "dashboardUID", dashboardUID, "orgID", orgID)
		return
	}
	pattern := fmt.Sprintf(dashboardQueryKeyFormat+"*", orgID, dashboardUID)
	redisVarCacheLogger.Info("deleting redis cache for all entries of dashboard", "orgID", orgID, "dashboardUID", dashboardUID)
	DeleteMatchingKeys(ctx, pattern)
}

// Pass a list of dashboards to delete
// This has to be called with any folder delete flow
// Use go routine for calling this and for feature flag check
func DeleteFolderCache(orgID int64, dashboards []*dashboards.Dashboard) {
	redisVarCacheLogger.Info("deleting caching for list of dashboards", "orgID", orgID, "len", len(dashboards))
	for _, dashboard := range dashboards {
		DeleteDashboardCache(orgID, dashboard.UID)
	}
	redisVarCacheLogger.Info("deleted cache for given dashboards", "orgID", orgID, "len", len(dashboards))
}

// No need to check feature flag before this since it is called from API dedicated to deleting cache
// DeleteVariableCacheForUser deletes all cache entries for a specific user and variable
// This includes both regular keys (without parent values hash) and cascading keys (with parent values hash) for that user
// Uses wildcard pattern matching to delete all entries regardless of whether they have dependencies
// This function is synchronous and ensures deletion completes before returning
func DeleteVariableCacheForUser(orgID int64, dashboardUID string, variableName string, userID int64) bool {
	ctx, cancel := context.WithTimeout(context.Background(), remoteVariableCacheSettings.BackgroundDeletionTimeout)
	defer cancel()

	if !isValidQuerySubStr(variableName) || !isValidQuerySubStr(dashboardUID) {
		redisVarCacheLogger.Error("invalid input provided for deletion", "variableName", variableName, "dashboardUID", dashboardUID, "orgID", orgID, "userID", userID)
		return false
	}

	// Pattern to match all keys for this user and variable (both regular and cascading with any parent values hash)
	// Format: "varc_orgID:dashboardUID:variableName:userID*"
	// This matches:
	//   - Regular keys: "varc_orgID:dashboardUID:variableName:userID"
	//   - Cascading keys: "varc_orgID:dashboardUID:variableName:userID:{anyParentValuesHash}"
	pattern := GenerateQueryKey(orgID, dashboardUID, variableName, userID, "") + "*"
	//redisVarCacheLogger.Info("pattern is : ", pattern)
	redisVarCacheLogger.Info("deleting redis cache for user's entries of variable", "orgID", orgID, "dashboardUID", dashboardUID, "variableName", variableName, "userID", userID)
	// DeleteMatchingKeys is synchronous and blocks until all keys are deleted
	err := DeleteMatchingKeys(ctx, pattern)
	if err != nil {
		redisVarCacheLogger.Error("failed to delete matching keys", "pattern", pattern, "err", err)
		return false
	}
	return true
}

// No need to check feature flag before this since it is called from API dedicated to deleting cache
func DeleteVariableCache(orgID int64, dashboardUID string, variableName string) {
	ctx, cancel := context.WithTimeout(context.Background(), remoteVariableCacheSettings.BackgroundDeletionTimeout)
	defer cancel()

	if !isValidQuerySubStr(variableName) || !isValidQuerySubStr(dashboardUID) {
		redisVarCacheLogger.Error("invalid input provided for deletion", "variableName", variableName, "dashboardUID", dashboardUID, "orgID", orgID)
		return
	}

	pattern := fmt.Sprintf(variableQueryKeyFormat+"*", orgID, dashboardUID, variableName)
	redisVarCacheLogger.Info("deleting redis cache for all entries of variable", "orgID", orgID, "dashboardUID", dashboardUID, "variableName", variableName)
	DeleteMatchingKeys(ctx, pattern)
}

func snappyCompress(data []byte) ([]byte, error) {
	compressed := snappy.Encode(nil, data)
	return compressed, nil
}

func snappyDecompress(data []byte) (string, error) {
	decompressed, err := snappy.Decode(nil, data)
	if err != nil {
		return "", err
	}
	return string(decompressed), nil
}
