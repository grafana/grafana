package schema

import (
	"encoding/json"
	"sync"
)

// Cache is a simple schema cache.
type Cache struct {
	mu      sync.RWMutex
	schemas map[string]json.RawMessage
}

// NewCache creates new Cache.
func NewCache() *Cache {
	return &Cache{
		schemas: map[string]json.RawMessage{},
	}
}

// Update caches schema for a channel.
func (c *Cache) Update(channel string, schema json.RawMessage) error {
	c.mu.Lock()
	defer c.mu.Unlock()
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
