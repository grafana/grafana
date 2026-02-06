package membercache

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/hashicorp/golang-lru/v2/expirable"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/team"
)

var logger = log.New("team.membercache")

// Cache provides an in-memory cache for team member permissions
// to reduce database load when users belong to many teams/groups
type Cache interface {
	// Get retrieves a cached permission for a team member
	Get(ctx context.Context, orgID, teamID, userID int64) (team.PermissionType, bool)

	// Set stores a team member permission in the cache
	Set(ctx context.Context, orgID, teamID, userID int64, permission team.PermissionType)

	// ClearUser removes all cached entries for a specific user
	ClearUser(ctx context.Context, userID int64)

	// ClearAll removes all entries from the cache
	ClearAll(ctx context.Context)

	// Len returns the current number of entries in the cache
	Len() int
}

type cacheImpl struct {
	cache  *expirable.LRU[string, team.PermissionType]
	tracer tracing.Tracer

	// userKeys maps userID to a list of cache keys for that user
	// This enables efficient cache clearing on login
	userKeys map[int64][]string
	mu       sync.RWMutex
}

// NewCache creates a new team member cache with LRU+TTL eviction
func NewCache(maxSize int, ttl time.Duration, tracer tracing.Tracer) Cache {
	logger.Info("Initializing team member cache", "maxSize", maxSize, "ttl", ttl)

	cache := expirable.NewLRU[string, team.PermissionType](
		maxSize,
		func(key string, value team.PermissionType) {
			// Eviction callback - log when entries are evicted
			logger.Debug("Cache entry evicted", "key", key)
		},
		ttl,
	)

	return &cacheImpl{
		cache:    cache,
		tracer:   tracer,
		userKeys: make(map[int64][]string),
	}
}

func (c *cacheImpl) Get(ctx context.Context, orgID, teamID, userID int64) (team.PermissionType, bool) {
	_, span := c.tracer.Start(ctx, "team.membercache.Get", trace.WithAttributes(
		attribute.Int64("org_id", orgID),
		attribute.Int64("team_id", teamID),
		attribute.Int64("user_id", userID),
	))
	defer span.End()

	key := makeCacheKey(orgID, teamID, userID)
	value, found := c.cache.Get(key)

	span.SetAttributes(attribute.Bool("cache.hit", found))

	if found {
		logger.Debug("Cache hit", "key", key, "permission", value)
	} else {
		logger.Debug("Cache miss", "key", key)
	}

	return value, found
}

func (c *cacheImpl) Set(ctx context.Context, orgID, teamID, userID int64, permission team.PermissionType) {
	_, span := c.tracer.Start(ctx, "team.membercache.Set", trace.WithAttributes(
		attribute.Int64("org_id", orgID),
		attribute.Int64("team_id", teamID),
		attribute.Int64("user_id", userID),
		attribute.Int64("permission", int64(permission)),
	))
	defer span.End()

	key := makeCacheKey(orgID, teamID, userID)
	c.cache.Add(key, permission)

	// Track this key for the user to enable efficient clearing
	c.mu.Lock()
	c.userKeys[userID] = append(c.userKeys[userID], key)
	c.mu.Unlock()

	logger.Debug("Cache entry added", "key", key, "permission", permission)
}

func (c *cacheImpl) ClearUser(ctx context.Context, userID int64) {
	_, span := c.tracer.Start(ctx, "team.membercache.ClearUser", trace.WithAttributes(
		attribute.Int64("user_id", userID),
	))
	defer span.End()

	c.mu.Lock()
	defer c.mu.Unlock()

	keys, exists := c.userKeys[userID]
	if !exists {
		logger.Debug("No cache entries found for user", "userID", userID)
		return
	}

	clearedCount := 0
	for _, key := range keys {
		if c.cache.Remove(key) {
			clearedCount++
		}
	}

	// Remove the user's key list
	delete(c.userKeys, userID)

	span.SetAttributes(attribute.Int("cleared_entries", clearedCount))
	logger.Info("Cleared user cache entries", "userID", userID, "count", clearedCount)
}

func (c *cacheImpl) ClearAll(ctx context.Context) {
	_, span := c.tracer.Start(ctx, "team.membercache.ClearAll")
	defer span.End()

	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache.Purge()
	c.userKeys = make(map[int64][]string)

	logger.Info("Cleared all cache entries")
}

func (c *cacheImpl) Len() int {
	return c.cache.Len()
}

// makeCacheKey creates a cache key from org, team, and user IDs
func makeCacheKey(orgID, teamID, userID int64) string {
	return fmt.Sprintf("%d:%d:%d", orgID, teamID, userID)
}

// NoOpCache is a cache implementation that does nothing (for when feature flag is disabled)
type NoOpCache struct{}

func (n *NoOpCache) Get(ctx context.Context, orgID, teamID, userID int64) (team.PermissionType, bool) {
	return 0, false
}

func (n *NoOpCache) Set(ctx context.Context, orgID, teamID, userID int64, permission team.PermissionType) {
}

func (n *NoOpCache) ClearUser(ctx context.Context, userID int64) {
}

func (n *NoOpCache) ClearAll(ctx context.Context) {
}

func (n *NoOpCache) Len() int {
	return 0
}
