package managedstream

import (
	"encoding/json"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// FrameCacheMemory ...
type FrameCacheMemory struct {
	mu     sync.RWMutex
	frames map[int64]map[string]data.FrameJSONCache
}

// NewFrameCacheMemory ...
func NewFrameCacheMemory() *FrameCacheMemory {
	return &FrameCacheMemory{
		frames: map[int64]map[string]data.FrameJSONCache{},
	}
}

func (u *FrameCacheMemory) GetActivePaths(orgID int64) (map[string]json.RawMessage, error) {
	u.mu.RLock()
	defer u.mu.RUnlock()
	frames, ok := u.frames[orgID]
	if !ok {
		return nil, nil
	}
	info := make(map[string]json.RawMessage, len(frames))
	for k, v := range frames {
		info[k] = v.Bytes(data.IncludeSchemaOnly)
	}
	return info, nil
}

func (u *FrameCacheMemory) GetSchema(orgID int64, path string) (json.RawMessage, bool, error) {
	u.mu.RLock()
	defer u.mu.RUnlock()
	cachedFrame, ok := u.frames[orgID][path]
	return cachedFrame.Bytes(data.IncludeSchemaOnly), ok, nil
}

func (u *FrameCacheMemory) GetFrame(orgID int64, path string) (json.RawMessage, bool, error) {
	u.mu.RLock()
	defer u.mu.RUnlock()
	cachedFrame, ok := u.frames[orgID][path]
	return cachedFrame.Bytes(data.IncludeAll), ok, nil
}

func (u *FrameCacheMemory) Update(orgID int64, path string, frame *data.Frame) (data.FrameJSONCache, bool, error) {
	u.mu.Lock()
	defer u.mu.Unlock()
	msg, err := data.FrameToJSONCache(frame)
	if err != nil {
		return data.FrameJSONCache{}, false, err
	}
	if _, ok := u.frames[orgID]; !ok {
		u.frames[orgID] = map[string]data.FrameJSONCache{}
	}
	cachedSchema, exists := u.frames[orgID][path]
	schemaUpdated := !exists || !cachedSchema.SameSchema(&msg)
	u.frames[orgID][path] = msg
	return msg, schemaUpdated, nil
}
