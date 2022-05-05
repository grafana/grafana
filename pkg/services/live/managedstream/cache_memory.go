package managedstream

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// MemoryFrameCache ...
type MemoryFrameCache struct {
	mu     sync.RWMutex
	frames map[int64]map[string]data.FrameJSONCache
}

// NewMemoryFrameCache ...
func NewMemoryFrameCache() *MemoryFrameCache {
	return &MemoryFrameCache{
		frames: map[int64]map[string]data.FrameJSONCache{},
	}
}

func (c *MemoryFrameCache) GetActiveChannels(orgID int64) (map[string]json.RawMessage, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	frames, ok := c.frames[orgID]
	if !ok {
		return nil, nil
	}
	info := make(map[string]json.RawMessage, len(frames))
	for k, v := range frames {
		info[k] = v.Bytes(data.IncludeSchemaOnly)
	}
	return info, nil
}

func (c *MemoryFrameCache) GetFrame(ctx context.Context, orgID int64, channel string) (json.RawMessage, bool, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	cachedFrame, ok := c.frames[orgID][channel]
	return cachedFrame.Bytes(data.IncludeAll), ok, nil
}

func (c *MemoryFrameCache) Update(ctx context.Context, orgID int64, channel string, jsonFrame data.FrameJSONCache) (bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.frames[orgID]; !ok {
		c.frames[orgID] = map[string]data.FrameJSONCache{}
	}
	cachedJsonFrame, exists := c.frames[orgID][channel]
	schemaUpdated := !exists || !cachedJsonFrame.SameSchema(&jsonFrame)
	c.frames[orgID][channel] = jsonFrame
	return schemaUpdated, nil
}
