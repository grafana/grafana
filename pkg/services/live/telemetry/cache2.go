package telemetry

import (
	"sync"
)

// Cache2 is a simple schema cache.
type Cache2 struct {
	mu  sync.RWMutex
	ids map[string]*Cache
}

// NewCache creates new Cache.
func NewCache2() *Cache2 {
	return &Cache2{
		ids: make(map[string]*Cache),
	}
}

// Get retrieves schema for a channel.
func (c *Cache2) GetOrCreate(channel string) *Cache {
	c.mu.RLock()
	defer c.mu.RUnlock()
	val, ok := c.ids[channel]
	if !ok {
		val = NewCache()
		c.mu.Lock()
		defer c.mu.Unlock()
		c.ids[channel] = val
	}
	return val
}
