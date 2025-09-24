package managedstream

import (
	"os"
	"strings"
	"testing"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
)

func TestIntegrationRedisCacheStorage(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
	prefix := uuid.New().String()

	t.Cleanup(redisCleanup(t, redisClient, prefix))

	c := NewRedisFrameCache(redisClient, prefix)
	require.NotNil(t, c)
	testFrameCache(t, c)

	keys, err := redisClient.Keys(redisClient.Context(), "*").Result()
	if err != nil {
		require.NoError(t, err)
	}

	require.NotZero(t, len(keys))

	for _, key := range keys {
		require.True(t, strings.HasPrefix(key, prefix))
	}
}

func redisCleanup(t *testing.T, redisClient *redis.Client, prefix string) func() {
	return func() {
		keys, err := redisClient.Keys(redisClient.Context(), prefix+"*").Result()
		if err != nil {
			require.NoError(t, err)
		}

		for _, key := range keys {
			_, err := redisClient.Del(redisClient.Context(), key).Result()
			require.NoError(t, err)
		}
	}
}
