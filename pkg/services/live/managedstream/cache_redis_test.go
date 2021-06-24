// +build redis

package managedstream

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/redis.v5"
)

func TestRedisCacheStorage(t *testing.T) {
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	c := NewRedisFrameCache(redisClient)
	require.NotNil(t, c)
	testFrameCache(t, c)
}
