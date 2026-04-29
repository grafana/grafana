package annotation

import (
	"context"
	"fmt"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru/v2"
)

// tagCache is an LRU cache with TTL for tag queries
type tagCache struct {
	cache *lru.Cache[string, *cachedTagResult]
	ttl   time.Duration
	mu    sync.RWMutex
}

// cachedTagResult holds cached tag results with expiration time
type cachedTagResult struct {
	tags      []Tag
	expiresAt time.Time
}

// newTagCache creates a new tag cache
func newTagCache(size int, ttl time.Duration) (*tagCache, error) {
	cache, err := lru.New[string, *cachedTagResult](size)
	if err != nil {
		return nil, fmt.Errorf("failed to create LRU cache: %w", err)
	}

	return &tagCache{
		cache: cache,
		ttl:   ttl,
	}, nil
}

// get retrieves tags from cache if valid
func (c *tagCache) get(key string) ([]Tag, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	cached, ok := c.cache.Get(key)
	if !ok {
		return nil, false
	}

	// Check if expired
	if time.Now().After(cached.expiresAt) {
		return nil, false
	}

	return cached.tags, true
}

// set stores tags in cache with TTL
func (c *tagCache) set(key string, tags []Tag) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache.Add(key, &cachedTagResult{
		tags:      tags,
		expiresAt: time.Now().Add(c.ttl),
	})
}

// cacheKey generates a cache key for tag queries
func tagCacheKey(namespace, prefix string, limit int) string {
	return fmt.Sprintf("%s:%s:%d", namespace, prefix, limit)
}

// ListTags implements the TagProvider interface.
// We use a cache here because tag queries can be expensive, and they don't change frequently.
func (s *PostgreSQLStore) ListTags(ctx context.Context, namespace string, opts TagListOptions) ([]Tag, error) {
	// Try cache first
	cacheKey := tagCacheKey(namespace, opts.Prefix, opts.Limit)
	if cached, ok := s.tagCache.get(cacheKey); ok {
		return cached, nil
	}

	// Build query
	query := `
		SELECT tag, COUNT(*) as count
		FROM annotations, unnest(tags) as tag
		WHERE namespace = $1
	`

	args := []any{namespace}
	argNum := 2

	// Add prefix filter if specified
	if opts.Prefix != "" {
		query += fmt.Sprintf(" AND tag LIKE $%d", argNum)
		args = append(args, opts.Prefix+"%")
		argNum++
	}

	query += `
		GROUP BY tag
		ORDER BY count DESC, tag
	`

	// Add limit
	limit := opts.Limit
	if limit == 0 {
		limit = 100 // default
	}
	query += fmt.Sprintf(" LIMIT $%d", argNum)
	args = append(args, limit)

	// Execute query
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query tags: %w", err)
	}
	defer rows.Close()

	var tags []Tag
	for rows.Next() {
		var tag Tag
		if err := rows.Scan(&tag.Name, &tag.Count); err != nil {
			return nil, fmt.Errorf("failed to scan tag row: %w", err)
		}
		tags = append(tags, tag)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating tag rows: %w", err)
	}

	// Store in cache
	s.tagCache.set(cacheKey, tags)

	return tags, nil
}
