package managedstream

import (
	"context"
	"encoding/json"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
)

// MemoryFrameCache ...
type MemoryFrameCache struct {
	mu     sync.RWMutex
	frames map[string]map[string]data.FrameJSONCache
	log    log.Logger
}

// NewMemoryFrameCache ...
func NewMemoryFrameCache() *MemoryFrameCache {
	return &MemoryFrameCache{
		frames: map[string]map[string]data.FrameJSONCache{},
		log:    log.New("live.memoryframecache"),
	}
}

func (c *MemoryFrameCache) GetActiveChannels(ns string) (map[string]json.RawMessage, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	frames, ok := c.frames[ns]
	if !ok {
		return nil, nil
	}
	info := make(map[string]json.RawMessage, len(frames))
	for k, v := range frames {
		info[k] = v.Bytes(data.IncludeSchemaOnly)
	}
	return info, nil
}

func (c *MemoryFrameCache) GetFrame(ctx context.Context, ns string, channel string) (json.RawMessage, bool, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	cachedFrame, ok := c.frames[ns][channel]
	raw := cachedFrame.Bytes(data.IncludeAll)
	c.log.Debug("Cache get",
		"ns", ns,
		"channel", channel,
		"length", len(raw),
	)
	return raw, ok, nil
}

func (c *MemoryFrameCache) Update(ctx context.Context, ns string, channel string, jsonFrame data.FrameJSONCache) (bool, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, ok := c.frames[ns]; !ok {
		c.frames[ns] = map[string]data.FrameJSONCache{}
	}
	cachedJsonFrame, exists := c.frames[ns][channel]
	schemaUpdated := !exists || !cachedJsonFrame.SameSchema(&jsonFrame)
	c.frames[ns][channel] = jsonFrame
	c.log.Debug("Cache update",
		"ns", ns,
		"channel", channel,
		"length", len(jsonFrame.Bytes(data.IncludeAll)),
	)
	return schemaUpdated, nil
}
