//go:build redis
// +build redis

package leader

import (
	"context"
	"testing"

	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/require"
)

func TestRedisCacheStorage(t *testing.T) {
	redisClient := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	m := NewRedisManager("", redisClient)
	require.NotNil(t, m)

	ctx := context.Background()

	exists, _, _, err := m.GetLeader(ctx, "test")
	require.NoError(t, err)
	require.False(t, exists)

	leaderNodeID, leadershipID, err := m.GetOrCreateLeader(ctx, "test", "nodeID", "leadershipID")
	require.NoError(t, err)
	require.Equal(t, "nodeID", leaderNodeID)
	require.Equal(t, "leadershipID", leadershipID)

	leaderNodeID, leadershipID, err = m.GetOrCreateLeader(ctx, "test", "nodeID2", "leadershipID2")
	require.NoError(t, err)
	require.Equal(t, "nodeID", leaderNodeID)
	require.Equal(t, "leadershipID", leadershipID)

	exists, leaderNodeID, leadershipID, err = m.GetLeader(ctx, "test")
	require.NoError(t, err)
	require.True(t, exists)
	require.Equal(t, "nodeID", leaderNodeID)
	require.Equal(t, "leadershipID", leadershipID)

	ok, err := m.RefreshLeader(ctx, "test", "leadershipID")
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = m.RefreshLeader(ctx, "test", "leadershipID2")
	require.NoError(t, err)
	require.False(t, ok)

	ok, err = m.CleanLeader(ctx, "test", "leadershipID2")
	require.NoError(t, err)
	require.False(t, ok)

	ok, err = m.CleanLeader(ctx, "test", "leadershipID")
	require.NoError(t, err)
	require.True(t, ok)

	ok, err = m.RefreshLeader(ctx, "test", "leadershipID")
	require.NoError(t, err)
	require.False(t, ok)
}
