package notifier

import (
	"context"

	"github.com/gogo/protobuf/proto"
	"github.com/prometheus/alertmanager/cluster"
	"github.com/prometheus/alertmanager/cluster/clusterpb"
)

type RedisChannel struct {
	p       *redisPeer
	key     string
	channel string
	msgType string
	msgc    chan []byte
}

func newRedisChannel(p *redisPeer, key, channel, msgType string) cluster.ClusterChannel {
	redisChannel := &RedisChannel{
		p:       p,
		key:     key,
		channel: channel,
		msgType: msgType,
		// The buffer size of 200 was taken from the Memberlist implementation.
		msgc: make(chan []byte, 200),
	}
	go redisChannel.handleMessages()
	return redisChannel
}

func (c *RedisChannel) handleMessages() {
	for {
		select {
		case <-c.p.shutdownc:
			return
		case b := <-c.msgc:
			pub := c.p.redis.Publish(context.Background(), c.channel, string(b))
			// An error here might not be as critical as one might think on first sight.
			// The state will eventually be propagated to other members by the full sync.
			if pub.Err() != nil {
				c.p.messagesPublishFailures.WithLabelValues(c.msgType, reasonRedisIssue).Inc()
				c.p.logger.Error("error publishing a message to redis", "err", pub.Err(), "channel", c.channel)
				continue
			}
			c.p.messagesSent.WithLabelValues(c.msgType).Inc()
			c.p.messagesSentSize.WithLabelValues(c.msgType).Add(float64(len(b)))
		}
	}
}

func (c *RedisChannel) Broadcast(b []byte) {
	b, err := proto.Marshal(&clusterpb.Part{Key: c.key, Data: b})
	if err != nil {
		c.p.logger.Error("error marshalling broadcast into proto", "err", err, "channel", c.channel)
		return
	}
	select {
	case c.msgc <- b:
	default:
		// This is not the end of the world, we will catch up when we do a full state sync.
		c.p.messagesPublishFailures.WithLabelValues(c.msgType, reasonBufferOverflow).Inc()
		c.p.logger.Warn("buffer full, droping message", "channel", c.channel)
	}
}
