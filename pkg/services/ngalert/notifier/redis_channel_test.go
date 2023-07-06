package notifier

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/prometheus/alertmanager/cluster/clusterpb"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func TestNewRedisChannel(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	defer mr.Close()

	rdb := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	p := &redisPeer{
		redis: rdb,
	}

	channel := newRedisChannel(p, "testKey", "testChannel", "testType")
	require.NotNil(t, channel)
}

func TestBroadcastAndHandleMessages(t *testing.T) {
	const channelName = "testChannel"

	mr, err := miniredis.Run()
	require.NoError(t, err)
	defer mr.Close()

	rdb := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	p := &redisPeer{
		redis:            rdb,
		messagesSent:     prometheus.NewCounterVec(prometheus.CounterOpts{}, []string{update}),
		messagesSentSize: prometheus.NewCounterVec(prometheus.CounterOpts{}, []string{update}),
	}

	channel := newRedisChannel(p, "testKey", channelName, "testType").(*RedisChannel)

	pubSub := rdb.Subscribe(context.Background(), channelName)
	msgs := pubSub.Channel()

	msg := []byte("test message")
	channel.Broadcast(msg)

	receivedMsg := <-msgs

	var part clusterpb.Part
	err = part.Unmarshal([]byte(receivedMsg.Payload))
	require.NoError(t, err)

	require.Equal(t, channelName, receivedMsg.Channel)
	require.Equal(t, msg, part.Data)
}
