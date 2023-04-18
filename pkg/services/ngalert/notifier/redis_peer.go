package notifier

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"sync"
	"time"

	"github.com/gogo/protobuf/proto"
	"github.com/google/uuid"
	"github.com/prometheus/alertmanager/cluster"
	"github.com/prometheus/alertmanager/cluster/clusterpb"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/redis/go-redis/v9"

	"github.com/grafana/grafana/pkg/infra/log"
)

type redisConfig struct {
	addr     string
	username string
	password string
	db       int
	name     string
	prefix   string
}

const (
	peerPattern             = "*"
	fullState               = "full_state"
	fullStateChannel        = fullState
	fullStateChannelReq     = fullStateChannel + ":request"
	update                  = "update"
	redisServerLabel        = "redis-server"
	networkRetryIntervalMin = time.Millisecond * 100
	networkRetryIntervalMax = time.Second * 10
	membersSyncInterval     = time.Second * 5
	waitForMsgIdle          = time.Millisecond * 100
	reasonBufferOverflow    = "buffer_overflow"
	reasonRedisIssue        = "redis_issue"
)

type redisPeer struct {
	name      string
	redis     *redis.Client
	prefix    string
	logger    log.Logger
	states    map[string]cluster.State
	subs      map[string]*redis.PubSub
	statesMtx sync.RWMutex

	heartbeatInterval time.Duration
	heartbeatTimeout  time.Duration

	readyc    chan struct{}
	shutdownc chan struct{}

	pushPullInterval time.Duration

	messagesReceived        *prometheus.CounterVec
	messagesReceivedSize    *prometheus.CounterVec
	messagesSent            *prometheus.CounterVec
	messagesSentSize        *prometheus.CounterVec
	messagesPublishFailures *prometheus.CounterVec
	nodePingDuration        *prometheus.HistogramVec
	nodePingFailures        prometheus.Counter

	// List of active members of the cluster. Should be accessed through the Members function.
	members    []string
	membersMtx sync.Mutex
	// The time when we fetched the members from redis the last time successfully.
	membersFetchedAt time.Time
	// The duration we want to return the members if the network is down.
	membersValidFor time.Duration
}

func newRedisPeer(cfg redisConfig, logger log.Logger, reg prometheus.Registerer,
	pushPullInterval time.Duration) (*redisPeer, error) {
	name := "peer-" + uuid.New().String()
	// If a specific name is provided, overwrite default one.
	if cfg.name != "" {
		name = cfg.name
	}
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.addr,
		Username: cfg.username,
		Password: cfg.password,
		DB:       cfg.db,
	})
	cmd := rdb.Ping(context.Background())
	if cmd.Err() != nil {
		return nil, fmt.Errorf("failed to ping redis: %w", cmd.Err())
	}
	// Make sure that the prefix uses a colon at the end as deliminator.
	if cfg.prefix != "" && cfg.prefix[len(cfg.prefix)-1] != ':' {
		cfg.prefix = cfg.prefix + ":"
	}
	p := &redisPeer{
		name:              name,
		redis:             rdb,
		logger:            logger,
		states:            map[string]cluster.State{},
		subs:              map[string]*redis.PubSub{},
		pushPullInterval:  pushPullInterval,
		readyc:            make(chan struct{}),
		shutdownc:         make(chan struct{}),
		prefix:            cfg.prefix,
		heartbeatInterval: time.Second * 5,
		heartbeatTimeout:  time.Minute,
		members:           make([]string, 0),
		membersValidFor:   time.Minute,
	}

	// The metrics for the redis peer are exactly the same as for the official
	// upstream Memberlist implementation. Three metrics that doesn't make sense
	// for redis are not available: messagesPruned, messagesQueued, nodeAlive.
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
	messagesPublishFailures := prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "alertmanager_cluster_messages_publish_failures_total",
		Help: "Total number of messages that failed to be published.",
	}, []string{"msg_type", "reason"})
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
	nodePingDuration := prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "alertmanager_cluster_pings_seconds",
		Help:    "Histogram of latencies for ping messages.",
		Buckets: []float64{.005, .01, .025, .05, .1, .25, .5},
	}, []string{"peer"},
	)
	nodePingFailures := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "alertmanager_cluster_pings_failures_total",
		Help: "Total number of failed pings.",
	})

	messagesReceived.WithLabelValues(fullState)
	messagesReceivedSize.WithLabelValues(fullState)
	messagesReceived.WithLabelValues(update)
	messagesReceivedSize.WithLabelValues(update)
	messagesSent.WithLabelValues(fullState)
	messagesSentSize.WithLabelValues(fullState)
	messagesSent.WithLabelValues(update)
	messagesSentSize.WithLabelValues(update)
	messagesPublishFailures.WithLabelValues(fullState, reasonRedisIssue)
	messagesPublishFailures.WithLabelValues(update, reasonRedisIssue)
	messagesPublishFailures.WithLabelValues(update, reasonBufferOverflow)

	reg.MustRegister(messagesReceived, messagesReceivedSize, messagesSent, messagesSentSize,
		gossipClusterMembers, peerPosition, healthScore, nodePingDuration, nodePingFailures,
		messagesPublishFailures,
	)

	p.messagesReceived = messagesReceived
	p.messagesReceivedSize = messagesReceivedSize
	p.messagesSent = messagesSent
	p.messagesSentSize = messagesSentSize
	p.messagesPublishFailures = messagesPublishFailures
	p.nodePingDuration = nodePingDuration
	p.nodePingFailures = nodePingFailures

	p.subs[fullStateChannel] = p.redis.Subscribe(context.Background(), p.withPrefix(fullStateChannel))
	p.subs[fullStateChannelReq] = p.redis.Subscribe(context.Background(), p.withPrefix(fullStateChannelReq))

	go p.heartbeatLoop()
	go p.membersSyncLoop()
	go p.fullStateSyncPublishLoop()
	go p.fullStateSyncReceiveLoop()
	go p.fullStateReqReceiveLoop()

	return p, nil
}

func (p *redisPeer) withPrefix(str string) string {
	return p.prefix + str
}

func (p *redisPeer) heartbeatLoop() {
	ticker := time.NewTicker(p.heartbeatInterval)
	for {
		select {
		case <-ticker.C:
			startTime := time.Now()
			cmd := p.redis.Set(context.Background(), p.withPrefix(p.name), time.Now().Unix(), time.Minute*5)
			reqDur := time.Since(startTime)
			if cmd.Err() != nil {
				p.nodePingFailures.Inc()
				p.logger.Error("error setting the heartbeat key", "err", cmd.Err(), "peer", p.withPrefix(p.name))
				continue
			}
			p.nodePingDuration.WithLabelValues(redisServerLabel).Observe(reqDur.Seconds())
		case <-p.shutdownc:
			ticker.Stop()
			return
		}
	}
}

func (p *redisPeer) membersSyncLoop() {
	ticker := time.NewTicker(membersSyncInterval)
	for {
		select {
		case <-ticker.C:
			startTime := time.Now()
			// The 100 is a hint for the server, how many records there might be for the
			// provided pattern. It _might_ only return the first 100 records, which should
			// be more than enough for our use case.
			// More here: https://redis.io/commands/scan/
			members, _, err := p.redis.Scan(context.Background(), 0, p.withPrefix(peerPattern), 100).Result()
			if err != nil {
				p.logger.Error("error getting keys from redis", "err", err, "pattern", p.withPrefix(peerPattern))
				// To prevent a spike of duplicate messages, we return for the duration of
				// membersValidFor the last known members and only empty the list if we do
				// not eventually recover.
				if p.membersFetchedAt.Before(time.Now().Add(-p.membersValidFor)) {
					p.membersMtx.Lock()
					p.members = []string{}
					p.membersMtx.Unlock()
					continue
				}
				p.logger.Warn("fetching members from redis failed, falling back to last known members", "last_known", p.members)
				continue
			}
			// This might happen on startup, when no value is in the store yet.
			if len(members) == 0 {
				p.membersMtx.Lock()
				p.members = []string{}
				p.membersMtx.Unlock()
				continue
			}
			values := p.redis.MGet(context.Background(), members...)
			if values.Err() != nil {
				p.logger.Error("error getting values from redis", "err", values.Err(), "keys", members)
			}
			peers := []string{}
			// After getting the list of possible members from redis, we filter
			// those out that have failed to send a heartbeat during the heartbeatTimeout.
			for i, peer := range members {
				val := values.Val()[i]
				if val == nil {
					continue
				}
				ts, err := strconv.ParseInt(val.(string), 10, 64)
				if err != nil {
					p.logger.Error("error parsing timestamp value", "err", err, "peer", peer, "val", val)
					continue
				}
				tm := time.Unix(ts, 0)
				if tm.Before(time.Now().Add(-p.heartbeatTimeout)) {
					continue
				}
				peers = append(peers, peer)
			}
			sort.Strings(peers)
			dur := time.Since(startTime)
			p.logger.Debug("membership sync done", "duration_ms", dur.Milliseconds())
			p.membersMtx.Lock()
			p.members = peers
			p.membersMtx.Unlock()
			p.membersFetchedAt = time.Now()
		case <-p.shutdownc:
			ticker.Stop()
			return
		}
	}
}

func (p *redisPeer) Position() int {
	for i, peer := range p.Members() {
		if peer == p.withPrefix(p.name) {
			p.logger.Debug("cluster position found", "name", p.name, "position", i)
			return i
		}
	}
	p.logger.Warn("failed to look up position, falling back to position 0")
	return 0
}

// Returns the known size of the Cluster. This also includes dead nodes that
// haven't timeout yet.
func (p *redisPeer) ClusterSize() int {
	scan := p.redis.Scan(context.Background(), 0, p.withPrefix(peerPattern), 100)
	if scan.Err() != nil {
		p.logger.Error("error getting keys from redis", "err", scan.Err(), "pattern", p.withPrefix(peerPattern))
		return 0
	}
	members, _ := scan.Val()
	return len(members)
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
	p.membersMtx.Lock()
	defer p.membersMtx.Unlock()
	return p.members
}

func (p *redisPeer) WaitReady(ctx context.Context) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-p.readyc:
		return nil
	}
}

// Settle is mostly copied from uptream.
// Ref: https://github.com/prometheus/alertmanager/blob/2888649b473970400c0bd375fdd563486dc80481/cluster/cluster.go#L674-L712
func (p *redisPeer) Settle(ctx context.Context, interval time.Duration) {
	const NumOkayRequired = 3
	p.logger.Info("Waiting for gossip to settle...", "interval", interval)
	start := time.Now()
	nPeers := 0
	nOkay := 0
	totalPolls := 0
	for {
		select {
		case <-ctx.Done():
			elapsed := time.Since(start)
			p.logger.Info("gossip not settled but continuing anyway", "polls", totalPolls, "elapsed", elapsed)
			close(p.readyc)
			return
		case <-time.After(interval):
		}
		elapsed := time.Since(start)
		n := len(p.Members())
		if nOkay >= NumOkayRequired {
			p.logger.Info("gossip settled; proceeding", "elapsed", elapsed)
			break
		}
		if n == nPeers {
			nOkay++
			p.logger.Debug("gossip looks settled", "elapsed", elapsed)
		} else {
			nOkay = 0
			p.logger.Info("gossip not settled", "polls", totalPolls, "before", nPeers, "now", n, "elapsed", elapsed)
		}
		nPeers = n
		totalPolls++
	}
	p.requestFullState()
	close(p.readyc)
}

func (p *redisPeer) AddState(key string, state cluster.State, _ prometheus.Registerer) cluster.ClusterChannel {
	p.statesMtx.Lock()
	p.states[key] = state
	// As we also want to get the state from other nodes, we subscribe to the key.
	sub := p.redis.Subscribe(context.Background(), p.withPrefix(key))
	go p.receiveLoop(key, sub)
	p.subs[key] = sub
	return newRedisChannel(p, key, p.withPrefix(key), update)
}

func (p *redisPeer) receiveLoop(name string, channel *redis.PubSub) {
	for {
		select {
		case <-p.shutdownc:
			return
		case data := <-channel.Channel():
			p.messagesReceived.WithLabelValues(update).Inc()
			p.messagesReceivedSize.WithLabelValues(update).Add(float64(len(data.Payload)))

			var part clusterpb.Part
			if err := proto.Unmarshal([]byte(data.Payload), &part); err != nil {
				p.logger.Warn("error decoding the received broadcast message", "err", err)
				continue
			}

			p.statesMtx.RLock()
			s, ok := p.states[part.Key]
			p.statesMtx.RUnlock()

			if !ok {
				continue
			}
			if err := s.Merge(part.Data); err != nil {
				p.logger.Warn("error merging the received broadcast message", "err", err, "key", name)
				continue
			}
			p.logger.Debug("partial state was successfully merged", "key", name)
		default:
			time.Sleep(waitForMsgIdle)
		}
	}
}

func (p *redisPeer) fullStateReqReceiveLoop() {
	for {
		select {
		case <-p.shutdownc:
			return
		case data := <-p.subs[fullStateChannelReq].Channel():
			// The payload of a full state request is the name of the peer that is
			// requesting the full state. In case we received our own request, we
			// can just ignore it. Redis pub/sub fanouts to all clients, regardless
			// if a client was also the publisher.
			if data.Payload == p.name {
				continue
			}
			p.fullStateSyncPublish()
		default:
			time.Sleep(waitForMsgIdle)
		}
	}
}

func (p *redisPeer) fullStateSyncReceiveLoop() {
	for {
		select {
		case <-p.shutdownc:
			return
		case data := <-p.subs[fullStateChannel].Channel():

			p.messagesReceived.WithLabelValues(fullState).Inc()
			p.messagesReceivedSize.WithLabelValues(fullState).Add(float64(len(data.Payload)))

			var fs clusterpb.FullState
			if err := proto.Unmarshal([]byte(data.Payload), &fs); err != nil {
				p.logger.Warn("error unmarshaling the received remote state", "err", err)
				continue
			}
			// This inline func is just a lazy workaround so we can use defer in the loop.
			func() {
				p.statesMtx.RLock()
				defer p.statesMtx.RUnlock()
				for _, part := range fs.Parts {
					s, ok := p.states[part.Key]
					if !ok {
						p.logger.Warn("received", "unknown state key", "len", len(data.Payload), "key", part.Key)
						continue
					}
					if err := s.Merge(part.Data); err != nil {
						p.logger.Warn("error merging the received remote state", "err", err, "key", part.Key)
						return
					}
				}
				p.logger.Debug("full state was successfully merged")
			}()
		default:
			time.Sleep(waitForMsgIdle)
		}
	}
}

func (p *redisPeer) fullStateSyncPublish() {
	pub := p.redis.Publish(context.Background(), p.withPrefix(fullStateChannel), p.LocalState())
	if pub.Err() != nil {
		p.messagesPublishFailures.WithLabelValues(fullState, reasonRedisIssue).Inc()
		p.logger.Error("error publishing a message to redis", "err", pub.Err(), "channel", p.withPrefix(fullStateChannel))
	}
}

func (p *redisPeer) fullStateSyncPublishLoop() {
	ticker := time.NewTicker(p.pushPullInterval)
	for {
		select {
		case <-ticker.C:
			p.fullStateSyncPublish()
		case <-p.shutdownc:
			ticker.Stop()
			return
		}
	}
}

func (p *redisPeer) requestFullState() {
	pub := p.redis.Publish(context.Background(), p.withPrefix(fullStateChannelReq), p.name)
	if pub.Err() != nil {
		p.messagesPublishFailures.WithLabelValues(fullState, reasonRedisIssue).Inc()
		p.logger.Error("error publishing a message to redis", "err", pub.Err(), "channel", p.withPrefix(fullStateChannelReq))
	}
}

func (p *redisPeer) LocalState() []byte {
	p.statesMtx.RLock()
	defer p.statesMtx.RUnlock()
	all := &clusterpb.FullState{
		Parts: make([]clusterpb.Part, 0, len(p.states)),
	}

	for key, s := range p.states {
		b, err := s.MarshalBinary()
		if err != nil {
			p.logger.Warn("error encoding the local state", "err", err, "key", key)
		}
		all.Parts = append(all.Parts, clusterpb.Part{Key: key, Data: b})
	}
	b, err := proto.Marshal(all)
	if err != nil {
		p.logger.Warn("error encoding the local state to proto", "err", err)
	}
	p.messagesSent.WithLabelValues(fullState).Inc()
	p.messagesSentSize.WithLabelValues(fullState).Add(float64(len(b)))
	return b
}

func (p *redisPeer) Shutdown() {
	p.logger.Info("Stopping redis peer...")
	close(p.shutdownc)
	p.fullStateSyncPublish()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()
	del := p.redis.Del(ctx, p.withPrefix(p.name))
	if del.Err() != nil {
		p.logger.Error("error deleting the redis key on shutdown", "err", del.Err(), "key", p.withPrefix(p.name))
	}
}
