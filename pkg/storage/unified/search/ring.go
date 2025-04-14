package search

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/go-kit/log"
	"github.com/grafana/dskit/dns"
	"github.com/grafana/dskit/flagext"
	"github.com/grafana/dskit/grpcclient"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/kv/codec"
	"github.com/grafana/dskit/kv/memberlist"
	"github.com/grafana/dskit/netutil"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/ring/client"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
)

type RingConfig struct {
	KVStore          kv.Config     `yaml:"kvstore"`
	HeartbeatPeriod  time.Duration `yaml:"heartbeat_period" category:"advanced"`
	HeartbeatTimeout time.Duration `yaml:"heartbeat_timeout" category:"advanced"`

	// Instance details
	InstanceID             string   `yaml:"instance_id" doc:"default=<hostname>" category:"advanced"`
	InstanceInterfaceNames []string `yaml:"instance_interface_names" doc:"default=[<private network interfaces>]"`
	InstancePort           int      `yaml:"instance_port" category:"advanced"`
	InstanceAddr           string   `yaml:"instance_addr" category:"advanced"`
	NumTokens              int      `yaml:"num_tokens" category:"advanced"`

	// Injected internally
	ListenPort int `yaml:"-"`

	// Used for testing
	SkipUnregister bool `yaml:"-"`
}

var RingOp = ring.NewOp([]ring.InstanceState{ring.ACTIVE}, func(s ring.InstanceState) bool {
	// Only ACTIVE memora nodes get any work. If instance is not ACTIVE, we need to find another memora node.
	return s != ring.ACTIVE
})

var ip = "127.0.0.2"

// TODO make this configurable
var cfg_replaceme = RingConfig{
	KVStore:                kv.Config{Store: "memberlist"},
	HeartbeatPeriod:        15 * time.Second,
	HeartbeatTimeout:       time.Minute,
	InstanceInterfaceNames: netutil.PrivateNetworkInterfacesWithFallback([]string{"eth0", "en0"}, log.NewNopLogger()),
	InstanceAddr:           ip,
	// TODO configure this to match grpc server port
	ListenPort:             10000,
	InstancePort:           10000,
	NumTokens:              128,
}

const ringKey = "ring"
const ringName = "bleve"

var metricsPrefix = ringName + "_"

const ringAutoForgetUnhealthyPeriods = 2

func (cfg *RingConfig) ToLifecyclerConfig(logger log.Logger) (ring.BasicLifecyclerConfig, error) {
	instanceAddr, err := ring.GetInstanceAddr(cfg.InstanceAddr, cfg.InstanceInterfaceNames, logger, true)
	if err != nil {
		return ring.BasicLifecyclerConfig{}, err
	}

	instancePort := ring.GetInstancePort(cfg.InstancePort, cfg.ListenPort)

	return ring.BasicLifecyclerConfig{
		ID:                  cfg.InstanceID,
		Addr:                fmt.Sprintf("%s:%d", instanceAddr, instancePort),
		HeartbeatPeriod:     cfg.HeartbeatPeriod,
		HeartbeatTimeout:    cfg.HeartbeatTimeout,
		TokensObservePeriod: 0,
		NumTokens:           cfg.NumTokens,
	}, nil
}

func (cfg *RingConfig) ToRingConfig() ring.Config {
	rc := ring.Config{}
	flagext.DefaultValues(&rc)

	rc.KVStore = cfg.KVStore
	rc.HeartbeatTimeout = cfg.HeartbeatTimeout
	rc.SubringCacheDisabled = true

	rc.ReplicationFactor = 1

	return rc
}

func initRing(cfg *setting.Cfg, logger log.Logger, registerer prometheus.Registerer) (*ring.Ring, *ring.BasicLifecycler, error) {
	if cfg.IndexMemberlistJoinMember == "" {
		return nil, nil, fmt.Errorf("bad sharding configuration. Missing Join Member")
	}

	cfg_replaceme.InstanceAddr = cfg.IndexMemberlistBindAddr
	cfg_replaceme.InstanceID = cfg.IndexMemberlistBindAddr
	memberlistKVcfg := &memberlist.KVConfig{}
	flagext.DefaultValues(memberlistKVcfg)
	memberlistKVcfg.MetricsNamespace = ringName
	memberlistKVcfg.Codecs = []codec.Codec{
		ring.GetCodec(),
	}
	memberlistKVcfg.AdvertiseAddr = cfg.IndexMemberlistBindAddr
	memberlistKVcfg.TCPTransport.BindAddrs = []string{cfg.IndexMemberlistBindAddr}
	memberlistKVcfg.NodeName = cfg.IndexMemberlistBindAddr
	memberlistKVcfg.JoinMembers = []string{cfg.IndexMemberlistJoinMember}

	dnsProviderReg := prometheus.WrapRegistererWithPrefix(
		metricsPrefix,
		prometheus.WrapRegistererWith(
			prometheus.Labels{"component": "memberlist"},
			registerer,
		),
	)
	dnsProvider := dns.NewProvider(logger, dnsProviderReg, dns.GolangResolverType)

	memberlistKVsvc := memberlist.NewKVInitService(memberlistKVcfg, logger, dnsProvider, registerer)
	memberlistKVsvc.StartAsync(context.Background())
	cfg_replaceme.KVStore.MemberlistKV = memberlistKVsvc.GetMemberlistKV

	ringStore, err := kv.NewClient(
		cfg_replaceme.KVStore,
		ring.GetCodec(),
		kv.RegistererWithKVName(prometheus.WrapRegistererWithPrefix(metricsPrefix, registerer), "ruler"),
		logger,
	)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to create KV store client")
	}

	lifecyclerCfg, err := cfg_replaceme.ToLifecyclerConfig(logger)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to initialize ruler's lifecycler config")
	}

	// Define lifecycler delegates in reverse order (last to be called defined first because they're
	// chained via "next delegate").
	delegate := ring.BasicLifecyclerDelegate(ring.NewInstanceRegisterDelegate(ring.JOINING, cfg_replaceme.NumTokens))
	delegate = ring.NewLeaveOnStoppingDelegate(delegate, logger)
	delegate = ring.NewAutoForgetDelegate(cfg_replaceme.HeartbeatTimeout*ringAutoForgetUnhealthyPeriods, delegate, logger)

	lifecycler, err := ring.NewBasicLifecycler(
		lifecyclerCfg,
		ringName,
		ringKey,
		ringStore,
		delegate,
		logger,
		prometheus.WrapRegistererWithPrefix(metricsPrefix, registerer),
	)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to initialize ruler's lifecycler")
	}

	rulerRing, err := ring.NewWithStoreClientAndStrategy(
		cfg_replaceme.ToRingConfig(),
		ringName,
		ringKey,
		ringStore,
		ring.NewIgnoreUnhealthyInstancesReplicationStrategy(),
		prometheus.WrapRegistererWithPrefix(metricsPrefix, registerer),
		logger,
	)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to initialize ruler's ring")
	}

	return rulerRing, lifecycler, nil
}

func newClientPool(clientCfg grpcclient.Config, log *slog.Logger, reg prometheus.Registerer, cfg *setting.Cfg) *client.Pool {
	poolCfg := client.PoolConfig{
		CheckInterval:      10 * time.Second,
		HealthCheckEnabled: true,
		HealthCheckTimeout: 10 * time.Second,
	}
	clientsCount := promauto.With(reg).NewGauge(prometheus.GaugeOpts{
		Name: "memora_clients",
		Help: "The current number of memora clients in the pool.",
	})
	log.Info("ring client pool",
		"grcp.MaxSendMsgSize", clientCfg.MaxSendMsgSize,
		"grpc.MaxRecvMsgSize", clientCfg.MaxRecvMsgSize)

	factoryRequestDuration := promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
		Name:    "memora_client_request_duration_seconds",
		Help:    "Time spent executing requests to memora.",
		Buckets: prometheus.ExponentialBuckets(0.008, 4, 7),
	}, []string{"operation", "status_code"})

	factory := client.PoolInstFunc(func(inst ring.InstanceDesc) (client.PoolClient, error) {
		opts, err := clientCfg.DialOption(grpcclient.Instrument(factoryRequestDuration))
		if err != nil {
			return nil, err
		}

		conn, err := grpc.NewClient(inst.Addr, opts...)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to dial memora %s %s", inst.Id, inst.Addr)
		}

		// TODO only use this if FlagAppPlatformGrpcClientAuth is not enabled
		indexClient := resource.NewLegacyResourceClient(conn)

		return &resource.BleveRingClient{
			IndexClient:  indexClient,
			HealthClient: grpc_health_v1.NewHealthClient(conn),
			Conn:         conn,
		}, nil
	})

	return client.NewPool(ringName, poolCfg, nil, factory, clientsCount, nil /* TODO add logger here*/)
}
