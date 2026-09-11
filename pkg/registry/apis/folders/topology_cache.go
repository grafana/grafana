package folders

import (
	"context"
	"fmt"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

const folderTopologyCacheTTL = 5 * time.Second

type folderTopologyCacheKey struct {
	orgID     int64
	namespace string
}

type folderTopologyCacheEntry struct {
	expires time.Time
	items   []foldersv1.FolderInfo
}

type folderTopologyCache struct {
	mu      sync.RWMutex
	entries map[folderTopologyCacheKey]folderTopologyCacheEntry
	loads   singleflight.Group
	ttl     time.Duration
	now     func() time.Time
}

func newFolderTopologyCache(ttl time.Duration) *folderTopologyCache {
	return &folderTopologyCache{
		entries: make(map[folderTopologyCacheKey]folderTopologyCacheEntry),
		ttl:     ttl,
		now:     time.Now,
	}
}

func (c *folderTopologyCache) get(
	ctx context.Context,
	key folderTopologyCacheKey,
	loader func(context.Context) ([]foldersv1.FolderInfo, error),
) ([]foldersv1.FolderInfo, error) {
	if items, ok := c.cached(key); ok {
		return items, nil
	}

	value, err, _ := c.loads.Do(fmt.Sprintf("%d\x00%s", key.orgID, key.namespace), func() (any, error) {
		if items, ok := c.cached(key); ok {
			return items, nil
		}
		items, err := loader(ctx)
		if err != nil {
			return nil, err
		}
		items = neutralFolderTopology(items)
		c.mu.Lock()
		c.entries[key] = folderTopologyCacheEntry{expires: c.now().Add(c.ttl), items: items}
		c.mu.Unlock()
		return cloneFolderTopology(items), nil
	})
	if err != nil {
		return nil, err
	}
	return cloneFolderTopology(value.([]foldersv1.FolderInfo)), nil
}

func (c *folderTopologyCache) cached(key folderTopologyCacheKey) ([]foldersv1.FolderInfo, bool) {
	now := c.now()
	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok || !now.Before(entry.expires) {
		if ok {
			c.mu.Lock()
			if current, exists := c.entries[key]; exists && current.expires.Equal(entry.expires) {
				delete(c.entries, key)
			}
			c.mu.Unlock()
		}
		return nil, false
	}
	return cloneFolderTopology(entry.items), true
}

func neutralFolderTopology(items []foldersv1.FolderInfo) []foldersv1.FolderInfo {
	neutral := make([]foldersv1.FolderInfo, 0, len(items))
	for _, item := range items {
		neutral = append(neutral, foldersv1.FolderInfo{
			Name:   item.Name,
			Title:  item.Title,
			Parent: normalizeTreeParent(item.Parent),
		})
	}
	return neutral
}

func cloneFolderTopology(items []foldersv1.FolderInfo) []foldersv1.FolderInfo {
	return append([]foldersv1.FolderInfo(nil), items...)
}
