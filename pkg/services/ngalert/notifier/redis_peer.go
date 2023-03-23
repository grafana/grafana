package notifier

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/go-kit/log/level"
	"github.com/gogo/protobuf/proto"
	"github.com/google/uuid"
	"github.com/prometheus/alertmanager/cluster"
	"github.com/prometheus/alertmanager/cluster/clusterpb"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/redis/go-redis/v9"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/log"
)

type redisConfig struct {
	addr     string
	password string
	db       int
}

const (
	peerPattern      = "peer-*"
	fullState        = "full_state"
	fullStateChannel = fullState
	update           = "update"
	redisServerLabel = "redis-server"
)

type redisPeer struct {
	Name       string
	redis      *redis.Client
	logger     log.Logger
	quorum     int
	states     map[string]cluster.State
	subs       map[string]*redis.PubSub
	mtx        sync.RWMutex
	isShutdown bool

	readyc chan struct{}

	pushPullInterval time.Duration

	messagesReceived     *prometheus.CounterVec
	messagesReceivedSize *prometheus.CounterVec
	messagesSent         *prometheus.CounterVec
	messagesSentSize     *prometheus.CounterVec
	nodePingDuration     *prometheus.HistogramVec
}

func newRedisPeer(cfg redisConfig, logger log.Logger, reg prometheus.Registerer,
	pushPullInterval time.Duration) *redisPeer {
	name := "peer-" + uuid.New().String()
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.addr,
		Password: cfg.password, // no password set
		DB:       cfg.db,       // use default DB
	})
	cmd := rdb.Ping(context.Background())
	if cmd.Err() != nil {
		logger.Error("failed to ping redis", "err", cmd.Err(), "addr", cfg.addr, "db", cfg.db)
	}
	p := &redisPeer{
		Name:             name,
		redis:            rdb,
		logger:           logger,
		quorum:           3,
		states:           map[string]cluster.State{},
		subs:             map[string]*redis.PubSub{},
		pushPullInterval: pushPullInterval,
	}

	messagesReceived := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "alertmanager_cluster_messages_received_total",
		Help: "Total number of cluster messages received.",
	}, []string{"msg_type"})
	messagesReceivedSize := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "alertmanager_cluster_messages_received_size_total",
		Help: "Total size of cluster messages received.",
	}, []string{"msg_type"})
	messagesSent := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "alertmanager_cluster_messages_sent_total",
		Help: "Total number of cluster messages sent.",
	}, []string{"msg_type"})
	messagesSentSize := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "alertmanager_cluster_messages_sent_size_total",
		Help: "Total size of cluster messages sent.",
	}, []string{"msg_type"})
	// messagesPruned := prometheus.NewCounter(prometheus.CounterOpts{
	// 	Name: "alertmanager_cluster_messages_pruned_total",
	// 	Help: "Total number of cluster messages pruned.",
	// })
	gossipClusterMembers := prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Name: "alertmanager_cluster_members",
		Help: "Number indicating current number of members in cluster.",
	}, func() float64 {
		return float64(p.ClusterSize())
	})
	peerPosition := prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Name: "alertmanager_peer_position",
		Help: "Position the Alertmanager instance believes it's in. The position determines a peer's behavior in the cluster.",
	}, func() float64 {
		return float64(p.Position())
	})
	healthScore := prometheus.NewGaugeFunc(prometheus.GaugeOpts{
		Name: "alertmanager_cluster_health_score",
		Help: "Health score of the cluster. Lower values are better and zero means 'totally healthy'.",
	}, func() float64 {
		return float64(p.GetHealthScore())
	})
	// messagesQueued := prometheus.NewGaugeFunc(prometheus.GaugeOpts{
	// 	Name: "alertmanager_cluster_messages_queued",
	// 	Help: "Number of cluster messages which are queued.",
	// }, func() float64 {
	// 	return float64(bcast.NumQueued())
	// })
	// nodeAlive := prometheus.NewCounterVec(prometheus.CounterOpts{
	// 	Name: "alertmanager_cluster_alive_messages_total",
	// 	Help: "Total number of received alive messages.",
	// }, []string{"peer"},
	// )
	nodePingDuration := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "alertmanager_cluster_pings_seconds",
		Help:    "Histogram of latencies for ping messages.",
		Buckets: []float64{.005, .01, .025, .05, .1, .25, .5},
	}, []string{"peer"},
	)

	messagesReceived.WithLabelValues(fullState)
	messagesReceivedSize.WithLabelValues(fullState)
	messagesReceived.WithLabelValues(update)
	messagesReceivedSize.WithLabelValues(update)
	messagesSent.WithLabelValues(fullState)
	messagesSentSize.WithLabelValues(fullState)
	messagesSent.WithLabelValues(update)
	messagesSentSize.WithLabelValues(update)

	reg.MustRegister(messagesReceived, messagesReceivedSize, messagesSent, messagesSentSize,
		gossipClusterMembers, peerPosition, healthScore, nodePingDuration,
	)

	p.messagesReceived = messagesReceived
	p.messagesReceivedSize = messagesReceivedSize
	p.messagesSent = messagesSent
	p.messagesSentSize = messagesSentSize
	p.nodePingDuration = nodePingDuration

	p.subs[fullStateChannel] = p.redis.Subscribe(context.Background(), fullStateChannel)

	go p.heartbeatLoop()
	go p.fullStateSyncPublish()
	go p.fullStateSyncReceive()

	return p
}

func (p *redisPeer) heartbeatLoop() {
	for {
		startTime := time.Now()
		cmd := p.redis.Set(context.Background(), p.Name, time.Now().Unix(), time.Minute*30)
		reqDur := time.Since(startTime)
		p.nodePingDuration.WithLabelValues(redisServerLabel).Observe(reqDur.Seconds())
		if cmd.Err() != nil {
			logger.Error("failed to set key", "err", cmd.Err())
		}
		time.Sleep(time.Second * 30)
	}
}

func (p *redisPeer) Position() int {
	for i, peer := range p.Members() {
		if peer == p.Name {
			p.logger.Info("cluster position found", "name", p.Name, "position", i)
			return i
		}
	}
	return 0
}

// Returns the known size of the Cluster. This also includes dead nodes that
// haven't timeout yet.
func (p *redisPeer) ClusterSize() int {
	cmd := p.redis.Keys(context.Background(), peerPattern)
	if cmd.Err() != nil {
		p.logger.Error("error getting keys from redis", "err", cmd.Err())
		return 0
	}
	return len(cmd.Val())
}

// If the cluster is healthy it should return 0, otherwise the number of
// unhealthy nodes.
func (p *redisPeer) GetHealthScore() int {
	size := p.ClusterSize()
	members := len(p.Members())
	if size > members {
		return size - members
	}
	return 0
}

// Members returns a list of active cluster Members.
func (p *redisPeer) Members() []string {
	cmd := p.redis.Keys(context.Background(), peerPattern)
	if cmd.Err() != nil {
		p.logger.Error("error getting keys from redis")
	}
	// TODO: filter active
	peers := cmd.Val()
	sort.Strings(peers)
	return peers
}

func (p *redisPeer) WaitReady(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-p.readyc:
		return nil
	}
}

func (p *redisPeer) Settle(ctx context.Context, interval time.Duration) {
	const NumOkayRequired = 3
	level.Info(p.logger).Log("msg", "Waiting for gossip to settle...", "interval", interval)
	start := time.Now()
	nPeers := 0
	nOkay := 0
	totalPolls := 0
	for {
		select {
		case <-ctx.Done():
			elapsed := time.Since(start)
			level.Info(p.logger).Log("msg", "gossip not settled but continuing anyway", "polls", totalPolls, "elapsed", elapsed)
			close(p.readyc)
			return
		case <-time.After(interval):
		}
		elapsed := time.Since(start)
		n := len(p.Members())
		if nOkay >= NumOkayRequired {
			level.Info(p.logger).Log("msg", "gossip settled; proceeding", "elapsed", elapsed)
			break
		}
		if n == nPeers {
			nOkay++
			level.Debug(p.logger).Log("msg", "gossip looks settled", "elapsed", elapsed)
		} else {
			nOkay = 0
			level.Info(p.logger).Log("msg", "gossip not settled", "polls", totalPolls, "before", nPeers, "now", n, "elapsed", elapsed)
		}
		nPeers = n
		totalPolls++
	}
	close(p.readyc)
}

func (p *redisPeer) AddState(key string, state cluster.State, _ prometheus.Registerer) cluster.ClusterChannel {
	p.mtx.Lock()
	p.states[key] = state
	// As we also want to get the state from other nodes, we subscribe to the key.
	sub := p.redis.Subscribe(context.Background(), key)
	go p.receiveLoop(key, sub)
	p.subs[key] = sub
	p.mtx.Unlock()
	return &RedisChannel{
		p:       p,
		channel: key,
		msgType: update,
	}
}

func (p *redisPeer) Shutdown() {
	p.isShutdown = true
	for _, sub := range p.subs {
		p.logger.Info("closing subscription", "channel", sub.String())
		_ = sub.Close()
	}
}

func (p *redisPeer) receiveLoop(name string, channel *redis.PubSub) {
	for !p.isShutdown {
		p.messagesReceived.WithLabelValues(update).Inc()
		data, err := channel.ReceiveMessage(context.Background())
		if err != nil {
			p.logger.Error("error receiving message from redis", "err", err, "channel", data.Channel)
			continue
		}
		p.messagesReceivedSize.WithLabelValues(update).Add(float64(len(data.Payload)))
		var part clusterpb.Part
		if err := proto.Unmarshal([]byte(data.Payload), &part); err != nil {
			level.Warn(p.logger).Log("msg", "decode broadcast", "err", err)
			return
		}

		p.mtx.RLock()
		s, ok := p.states[part.Key]
		p.mtx.RUnlock()

		if !ok {
			return
		}
		if err := s.Merge(part.Data); err != nil {
			level.Warn(p.logger).Log("msg", "merge broadcast", "err", err, "key", name)
			return
		}
	}
}

func (p *redisPeer) fullStateSyncReceive() {
	for !p.isShutdown {
		p.messagesReceived.WithLabelValues(fullState).Inc()
		data, err := p.subs[fullStateChannel].ReceiveMessage(context.Background())
		if err != nil {
			p.logger.Error("error receiving message from redis", "err", err, "channel", data.Channel)
			continue
		}
		p.messagesReceivedSize.WithLabelValues(fullState).Add(float64(len(data.Payload)))

		var fs clusterpb.FullState
		if err := proto.Unmarshal([]byte(data.Payload), &fs); err != nil {
			level.Warn(p.logger).Log("msg", "merge remote state", "err", err)
			return
		}
		p.mtx.RLock()
		defer p.mtx.RUnlock()
		for _, part := range fs.Parts {
			s, ok := p.states[part.Key]
			if !ok {
				level.Warn(p.logger).Log("received", "unknown state key", "len", len(data.Payload), "key", part.Key)
				continue
			}
			if err := s.Merge(part.Data); err != nil {
				level.Warn(p.logger).Log("msg", "merge remote state", "err", err, "key", part.Key)
				return
			}
		}
	}
}

func (p *redisPeer) fullStateSyncPublish() {
	for !p.isShutdown {
		_ = p.redis.Publish(context.Background(), fullStateChannel, p.LocalState())
		time.Sleep(p.pushPullInterval)
	}
}

func (p *redisPeer) LocalState() []byte {
	p.mtx.RLock()
	defer p.mtx.RUnlock()
	all := &clusterpb.FullState{
		Parts: make([]clusterpb.Part, 0, len(p.states)),
	}

	for key, s := range p.states {
		b, err := s.MarshalBinary()
		if err != nil {
			level.Warn(p.logger).Log("msg", "encode local state", "err", err, "key", key)
		}
		all.Parts = append(all.Parts, clusterpb.Part{Key: key, Data: b})
	}
	b, err := proto.Marshal(all)
	if err != nil {
		level.Warn(p.logger).Log("msg", "encode local state", "err", err)
	}
	p.messagesSent.WithLabelValues(fullState).Inc()
	p.messagesSentSize.WithLabelValues(fullState).Add(float64(len(b)))
	return b
}

type RedisChannel struct {
	p       *redisPeer
	channel string
	msgType string
}

func (c *RedisChannel) Broadcast(b []byte) {
	c.p.messagesSent.WithLabelValues(c.msgType).Inc()
	c.p.messagesSentSize.WithLabelValues(c.msgType).Add(float64(len(b)))
	_ = c.p.redis.Publish(context.Background(), c.channel, string(b))
}
