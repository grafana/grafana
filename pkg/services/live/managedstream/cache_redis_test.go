//go:build redis
// +build redis

package managedstream

import (
	"testing"

	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func TestRedisCacheStorage(t *testing.T) {
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	c := NewRedisFrameCache(redisClient)
	require.NotNil(t, c)
	testFrameCache(t, c)
}
