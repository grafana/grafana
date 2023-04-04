package managedstream

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/services/live/orgchannel"
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

func (c *RedisFrameCache) GetFrame(ctx context.Context, orgID int64, channel string) (json.RawMessage, bool, error) {
	key := getCacheKey(orgchannel.PrependOrgID(orgID, channel))
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

func (c *RedisFrameCache) Update(ctx context.Context, orgID int64, channel string, jsonFrame data.FrameJSONCache) (bool, error) {
	c.mu.Lock()
	if _, ok := c.frames[orgID]; !ok {
		c.frames[orgID] = map[string]data.FrameJSONCache{}
	}
	c.frames[orgID][channel] = jsonFrame
	c.mu.Unlock()

	stringSchema := string(jsonFrame.Bytes(data.IncludeSchemaOnly))

	key := getCacheKey(orgchannel.PrependOrgID(orgID, channel))

	pipe := c.redisClient.TxPipeline()
	defer func() { _ = pipe.Close() }()

	pipe.HGetAll(ctx, key)
	pipe.HMSet(ctx, key, map[string]string{
		"schema": stringSchema,
		"frame":  string(jsonFrame.Bytes(data.IncludeAll)),
	})
	pipe.Expire(ctx, key, frameCacheTTL)

	replies, err := pipe.Exec(ctx)
	if err != nil {
		return false, err
	}
	if len(replies) == 0 {
		return false, errors.New("no replies in response")
	}
	reply := replies[0]

	if reply.Err() != nil {
		return false, err
	}

	if mapReply, ok := reply.(*redis.StringStringMapCmd); ok {
		result, err := mapReply.Result()
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

func getCacheKey(channelID string) string {
	return "gf_live.managed_stream." + channelID
}
