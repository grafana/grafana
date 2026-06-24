package managedstream

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/live/orgchannel"
)

// RedisFrameCache ...
type RedisFrameCache struct {
	mu          sync.RWMutex
	redisClient *redis.Client
	frames      map[string]map[string]data.FrameJSONCache
	keyPrefix   string
}

// NewRedisFrameCache ...
func NewRedisFrameCache(redisClient *redis.Client, keyPrefix string) *RedisFrameCache {
	return &RedisFrameCache{
		keyPrefix:   keyPrefix,
		frames:      map[string]map[string]data.FrameJSONCache{},
		redisClient: redisClient,
	}
}

func (c *RedisFrameCache) GetActiveChannels(ns string) (map[string]json.RawMessage, error) {
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

func (c *RedisFrameCache) GetFrame(ctx context.Context, ns string, channel string) (json.RawMessage, bool, error) {
	key := c.getCacheKey(orgchannel.PrependK8sNamespace(ns, channel))
	cmd := c.redisClient.HGetAll(ctx, key)
	result, err := cmd.Result()
	if err != nil {
		return nil, false, err
	}
	if len(result) == 0 {
		return nil, false, nil
	}
	return json.RawMessage(result["frame"]), true, nil
}

const (
	frameCacheTTL = 7 * 24 * time.Hour
)

func (c *RedisFrameCache) Update(ctx context.Context, ns string, channel string, jsonFrame data.FrameJSONCache) (bool, error) {
	c.mu.Lock()
	if _, ok := c.frames[ns]; !ok {
		c.frames[ns] = map[string]data.FrameJSONCache{}
	}
	c.frames[ns][channel] = jsonFrame
	c.mu.Unlock()

	stringSchema := string(jsonFrame.Bytes(data.IncludeSchemaOnly))

	key := c.getCacheKey(orgchannel.PrependK8sNamespace(ns, channel))

	var mapReply *redis.MapStringStringCmd
	replies, err := c.redisClient.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
		mapReply = pipe.HGetAll(ctx, key)
		pipe.HMSet(ctx, key, map[string]string{
			"schema": stringSchema,
			"frame":  string(jsonFrame.Bytes(data.IncludeAll)),
		})
		pipe.Expire(ctx, key, frameCacheTTL)
		return nil
	})
	if err != nil {
		return false, err
	}
	if len(replies) == 0 {
		return false, errors.New("no replies in response")
	}
	if mapReply.Err() != nil {
		return false, fmt.Errorf("error getting existing frame from redis: %w", mapReply.Err())
	}

	result, err := mapReply.Result()
	if err != nil {
		return false, err
	}
	if len(result) == 0 {
		return true, nil
	}
	return result["schema"] != stringSchema, nil
}

func (c *RedisFrameCache) getCacheKey(channelID string) string {
	return c.keyPrefix + ".managed_stream." + channelID
}
