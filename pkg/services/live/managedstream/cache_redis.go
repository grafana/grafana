package managedstream

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/live/orgchannel"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"gopkg.in/redis.v5"
)

// RedisFrameCache ...
type RedisFrameCache struct {
	mu          sync.RWMutex
	redisClient *redis.Client
	frames      map[int64]map[string]data.FrameJSONCache
}

// NewRedisFrameCache ...
func NewRedisFrameCache(redisClient *redis.Client) *RedisFrameCache {
	return &RedisFrameCache{
		frames:      map[int64]map[string]data.FrameJSONCache{},
		redisClient: redisClient,
	}
}

func (c *RedisFrameCache) GetActiveChannels(orgID int64) (map[string]json.RawMessage, error) {
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

func (c *RedisFrameCache) GetFrame(orgID int64, channel string) (json.RawMessage, bool, error) {
	key := orgchannel.PrependOrgID(orgID, channel)
	cmd := c.redisClient.HGetAll(key)
	result, err := cmd.Result()
	if err != nil {
		return nil, false, err
	}
	if len(result) == 0 {
		return nil, false, nil
	}
	return json.RawMessage(result["frame"]), true, nil
}

func (c *RedisFrameCache) Update(orgID int64, channel string, jsonFrame data.FrameJSONCache) (bool, error) {
	c.mu.Lock()
	if _, ok := c.frames[orgID]; !ok {
		c.frames[orgID] = map[string]data.FrameJSONCache{}
	}
	c.frames[orgID][channel] = jsonFrame
	c.mu.Unlock()
	key := orgchannel.PrependOrgID(orgID, channel)
	pipe := c.redisClient.Pipeline()
	pipe.HGetAll(key)
	stringSchema := string(jsonFrame.Bytes(data.IncludeSchemaOnly))
	pipe.HMSet(key, map[string]string{
		"schema": stringSchema,
		"frame":  string(jsonFrame.Bytes(data.IncludeAll)),
	})
	pipe.Expire(key, 7*24*time.Hour)
	replies, err := pipe.Exec()
	if err != nil {
		return false, err
	}
	if replies[0].Err() != nil {
		return false, err
	}
	if reply, ok := replies[0].(*redis.StringStringMapCmd); ok {
		result, err := reply.Result()
		if err != nil {
			return false, err
		}
		if len(result) == 0 {
			return true, nil
		}
		return result["schema"] != stringSchema, nil
	}
	return true, nil
}
