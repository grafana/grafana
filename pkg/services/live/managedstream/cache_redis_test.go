package managedstream

import (
	"os"
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

	addr := u
	db := 0
	parsed, err := redis.ParseURL(u)
	if err == nil {
		addr = parsed.Addr
		db = parsed.DB
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr: addr,
		DB:   db,
	})
	c := NewRedisFrameCache(redisClient)
	require.NotNil(t, c)
	testFrameCache(t, c)
}
