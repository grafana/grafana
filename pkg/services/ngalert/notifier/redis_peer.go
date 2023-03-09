package notifier

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/alertmanager/cluster"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/redis/go-redis/v9"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/log"
)

const peerPattern = "peer-*"

func NewRedisPeer(addr string, logger log.Logger) *RedisPeer {
	name := "peer-" + uuid.New().String()
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: "", // no password set
		DB:       0,  // use default DB
	})
	cmd := rdb.Ping(context.Background())
	if cmd.Err() != nil {
		logger.Error("failed to ping redis")
	}
	peer := &RedisPeer{
		Name:   name,
		client: rdb,
		logger: logger,
		quorum: 2,
		states: map[string]cluster.State{},
	}
	go peer.holdLock()
	return peer
}

type RedisPeer struct {
	Name     string
	client   *redis.Client
	logger   log.Logger
	quorum   int
	states   map[string]cluster.State
	stateMtx sync.Mutex
}

func (p *RedisPeer) holdLock() {
	for {
		cmd := p.client.Set(context.Background(), p.Name, "active", time.Second*60)
		if cmd.Err() != nil {
			logger.Error("failed to set key")
		}
		time.Sleep(time.Second * 30)
	}
}

func (p *RedisPeer) Position() int {
	cmd := p.client.Keys(context.Background(), peerPattern)
	if cmd.Err() != nil {
		p.logger.Error("error getting keys from redis")
	}
	peers := cmd.Val()
	sort.Strings(peers)

	for i, peer := range peers {
		if peer == p.Name {
			p.logger.Info("cluster position found", "position", i+1)
			return i + 1
		}
	}
	return -1
}

func (p *RedisPeer) WaitReady(context.Context) error {
	for {
		cmd := p.client.Keys(context.Background(), peerPattern)
		if cmd.Err() != nil {
			p.logger.Error("error getting keys from redis")
		}
		if len(cmd.Val()) >= p.quorum {
			p.logger.Info("cluster ready", "peers", len(cmd.Val()))
			return nil
		}

		p.logger.Info("wating for cluster to become ready",
			"sleep", "10s",
			"wanted_peers", p.quorum,
			"current_peers", len(cmd.Val()))
		time.Sleep(time.Second * 10)
	}
}

func (p *RedisPeer) AddState(key string, state cluster.State, _ prometheus.Registerer) cluster.ClusterChannel {
	p.stateMtx.Lock()
	p.states[key] = state
	p.stateMtx.Unlock()
	return &RedisChannel{
		client:  p.client,
		channel: key,
	}
}

type RedisChannel struct {
	client  *redis.Client
	channel string
}

func (c *RedisChannel) Broadcast(msg []byte) {
	_ = c.client.Publish(context.Background(), c.channel, string(msg))
}
