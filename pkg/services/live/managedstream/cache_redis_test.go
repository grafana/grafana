package managedstream

import (
	"os"
	"strings"
	"testing"

	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func TestIntegrationRedisCacheStorage(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	u, ok := os.LookupEnv("REDIS_URL")
	if !ok || u == "" {
		t.Skip("No redis URL supplied")
	}

	trimmed := strings.TrimLeft(u, "redis://")

	redisClient := redis.NewClient(&redis.Options{
		Addr: trimmed,
	})
	c := NewRedisFrameCache(redisClient)
	require.NotNil(t, c)
	testFrameCache(t, c)
}
