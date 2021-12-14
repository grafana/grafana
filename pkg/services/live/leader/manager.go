package leader

import (
	"context"
	"errors"
	"time"

	"github.com/go-redis/redis/v8"
)

type Manager interface {
	GetOrCreateLeader(ctx context.Context, ch string, currentNodeID string, newLeadershipID string) (string, string, error)
	GetLeader(ctx context.Context, ch string) (bool, string, string, error)
	TouchLeader(ctx context.Context, ch string, currentNodeID string, currentLeadershipID string) (bool, error)
	CleanLeader(ctx context.Context, ch string) error
}

type RedisManager struct {
	redisClient       *redis.Client
	getOrCreateScript *redis.Script
}

// KEYS[1] - channel hash key
// ARGV[1] - hash key expire seconds
// ARGV[2] - current node ID
// ARGV[3] - new leadership ID if key does not exist yet
// Returns leader nodeID and current leadershipID.
const getOrCreateScriptSource = `
if redis.call('exists', KEYS[1]) ~= 0 then
	redis.call("expire", KEYS[1], ARGV[1])
	return redis.call("hmget", KEYS[1], "n", "l")
end
redis.call("hmset", KEYS[1], "n", ARGV[2], "l", ARGV[3])
redis.call("expire", KEYS[1], ARGV[1])
-- TODO: can avoid Redis call.
return redis.call("hmget", KEYS[1], "n", "l")
`

func NewRedisManager(redisClient *redis.Client) *RedisManager {
	return &RedisManager{
		redisClient:       redisClient,
		getOrCreateScript: redis.NewScript(getOrCreateScriptSource),
	}
}

func (m *RedisManager) GetOrCreateLeader(ctx context.Context, ch string, currentNodeID string, newLeadershipID string) (string, string, error) {
	result, err := m.getOrCreateScript.Eval(ctx, m.redisClient, []string{ch}, 10, currentNodeID, newLeadershipID).StringSlice()
	if err != nil {
		return "", "", err
	}
	if len(result) != 2 {
		return "", "", errors.New("malformed result")
	}
	return result[0], result[1], nil
}

func (m *RedisManager) GetLeader(ctx context.Context, ch string) (bool, string, string, error) {
	result, err := m.redisClient.HMGet(ctx, ch, "n", "l").Result()
	if err != nil {
		return false, "", "", err
	}
	if len(result) != 2 {
		return false, "", "", errors.New("malformed result")
	}
	if result[0] == nil {
		return false, "", "", nil
	}
	return true, result[0].(string), result[1].(string), nil
}

func (m *RedisManager) TouchLeader(ctx context.Context, ch string, currentNodeID string, currentLeadershipID string) (bool, error) {
	return m.redisClient.Expire(ctx, ch, 10*time.Second).Result()
}

func (m *RedisManager) CleanLeader(ctx context.Context, ch string) error {
	_, err := m.redisClient.Del(ctx, ch).Result()
	return err
}
