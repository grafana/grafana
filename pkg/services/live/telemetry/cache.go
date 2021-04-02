package telemetry

import (
	"encoding/json"
	"sync"
	"time"
)

// Cache is a simple schema cache.
type Cache struct {
	mu      sync.RWMutex
	start   time.Time
	last    time.Time
	count   int64
	schemas map[string]json.RawMessage
}

// NewCache creates new Cache.
func NewCache() *Cache {
	return &Cache{
		start:   time.Now(),
		last:    time.Now(),
		schemas: map[string]json.RawMessage{},
	}
}

// Update caches schema for a channel.
func (c *Cache) Update(channel string, schema json.RawMessage) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.last = time.Now()
	c.schemas[channel] = schema
	return nil
}

// Get retrieves schema for a channel.
func (c *Cache) Get(channel string) (json.RawMessage, bool, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	schema, ok := c.schemas[channel]
	return schema, ok, nil
}

// Delete schema for a channel.
func (c *Cache) Delete(channel string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.schemas, channel)
	return nil
}
