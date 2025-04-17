package resource

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/go-kit/log"
	"github.com/grafana/dskit/dns"
	"github.com/grafana/dskit/flagext"
	"github.com/grafana/dskit/grpcclient"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/kv/codec"
	"github.com/grafana/dskit/kv/memberlist"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/ring/client"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
)

type resourceRingConfig struct {
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

var ringOp = ring.NewOp([]ring.InstanceState{ring.ACTIVE}, func(s ring.InstanceState) bool {
	return s != ring.ACTIVE
})

const ringKey = "ring"
const ringName = "unified_storage"

var metricsPrefix = ringName + "_"

const ringAutoForgetUnhealthyPeriods = 2

func (cfg *resourceRingConfig) toLifecyclerConfig(logger log.Logger) (ring.BasicLifecyclerConfig, error) {
	instanceAddr, err := ring.GetInstanceAddr(cfg.InstanceAddr, cfg.InstanceInterfaceNames, logger, true)
	if err != nil {
		return ring.BasicLifecyclerConfig{}, err
	}

	instancePort := ring.GetInstancePort(cfg.InstancePort, cfg.ListenPort)

	instanceId := cfg.InstanceID
	if instanceId == "" {
		hostname, err := os.Hostname()
		if err != nil {
			return ring.BasicLifecyclerConfig{}, err
		}

		instanceId = hostname
	}

	return ring.BasicLifecyclerConfig{
		Addr:                fmt.Sprintf("%s:%d", instanceAddr, instancePort),
		ID:                  instanceId,
		HeartbeatPeriod:     cfg.HeartbeatPeriod,
		HeartbeatTimeout:    cfg.HeartbeatTimeout,
		TokensObservePeriod: 0,
		NumTokens:           cfg.NumTokens,
	}, nil
}

func (cfg *resourceRingConfig) toRingConfig() ring.Config {
	rc := ring.Config{}
	flagext.DefaultValues(&rc)

	rc.KVStore = cfg.KVStore
	rc.HeartbeatTimeout = cfg.HeartbeatTimeout
	rc.SubringCacheDisabled = true

	rc.ReplicationFactor = 1

	return rc
}

func (cfg *resourceRingConfig) toMemberlistConfig(memberlistJoinMember string) *memberlist.KVConfig {
	memberlistKVcfg := &memberlist.KVConfig{}
	flagext.DefaultValues(memberlistKVcfg)
	memberlistKVcfg.MetricsNamespace = ringName
	memberlistKVcfg.Codecs = []codec.Codec{
		ring.GetCodec(),
	}
	memberlistKVcfg.AdvertiseAddr = cfg.InstanceAddr
	memberlistKVcfg.TCPTransport.BindAddrs = []string{cfg.InstanceAddr}
	memberlistKVcfg.NodeName = cfg.InstanceAddr
	memberlistKVcfg.JoinMembers = []string{memberlistJoinMember}

	return memberlistKVcfg
}

func initRing(cfg ShardingConfig, logger log.Logger, registerer prometheus.Registerer) (*ring.Ring, *ring.BasicLifecycler, error) {
	if cfg.MemberlistJoinMember == "" {
		return nil, nil, fmt.Errorf("bad sharding configuration. Missing Join Member")
	}

	resourceRingConfig := &resourceRingConfig{
		KVStore:          kv.Config{Store: "memberlist"},
		HeartbeatPeriod:  15 * time.Second,
		HeartbeatTimeout: time.Minute,
		InstanceID:        cfg.InstanceID,
		InstanceAddr:     cfg.MemberlistBindAddr,
		ListenPort:       cfg.RingListenPort,
		InstancePort:     cfg.RingListenPort,
		NumTokens:        128,
	}

	dnsProviderReg := prometheus.WrapRegistererWithPrefix(
		metricsPrefix,
		prometheus.WrapRegistererWith(
			prometheus.Labels{"component": "memberlist"},
			registerer,
		),
	)
	dnsProvider := dns.NewProvider(logger, dnsProviderReg, dns.GolangResolverType)

	memberlistKVcfg := resourceRingConfig.toMemberlistConfig(cfg.MemberlistJoinMember)
	memberlistKVsvc := memberlist.NewKVInitService(memberlistKVcfg, logger, dnsProvider, registerer)
	err := memberlistKVsvc.StartAsync(context.Background())
	if err != nil {
		return nil, nil, fmt.Errorf("failed to start memberlist service: %s", err)
	}
	resourceRingConfig.KVStore.MemberlistKV = memberlistKVsvc.GetMemberlistKV

	ringStore, err := kv.NewClient(
		resourceRingConfig.KVStore,
		ring.GetCodec(),
		kv.RegistererWithKVName(prometheus.WrapRegistererWithPrefix(metricsPrefix, registerer), "ruler"),
		logger,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create KV store client: %s", err)
	}

	lifecyclerCfg, err := resourceRingConfig.toLifecyclerConfig(logger)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to initialize ruler's lifecycler config: %s", err)
	}

	// Define lifecycler delegates in reverse order (last to be called defined first because they're
	// chained via "next delegate").
	delegate := ring.BasicLifecyclerDelegate(ring.NewInstanceRegisterDelegate(ring.JOINING, resourceRingConfig.NumTokens))
	delegate = ring.NewLeaveOnStoppingDelegate(delegate, logger)
	delegate = ring.NewAutoForgetDelegate(resourceRingConfig.HeartbeatTimeout*ringAutoForgetUnhealthyPeriods, delegate, logger)

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
		return nil, nil, fmt.Errorf("failed to initialize ruler's lifecycler: %s", err)
	}

	rulerRing, err := ring.NewWithStoreClientAndStrategy(
		resourceRingConfig.toRingConfig(),
		ringName,
		ringKey,
		ringStore,
		ring.NewIgnoreUnhealthyInstancesReplicationStrategy(),
		prometheus.WrapRegistererWithPrefix(metricsPrefix, registerer),
		logger,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to initialize ruler's ring: %s", err)
	}

	return rulerRing, lifecycler, nil
}

type ringClient struct {
	client ResourceClient
	grpc_health_v1.HealthClient
	conn *grpc.ClientConn
}

func (c ringClient) Close() error {
	return c.conn.Close()
}

func (c *ringClient) String() string {
	return c.RemoteAddress()
}

func (c *ringClient) RemoteAddress() string {
	return c.conn.Target()
}

func newClientPool(clientCfg grpcclient.Config, log log.Logger, reg prometheus.Registerer, tracer trace.Tracer) *client.Pool {
	poolCfg := client.PoolConfig{
		CheckInterval:      10 * time.Second,
		HealthCheckEnabled: true,
		HealthCheckTimeout: 10 * time.Second,
	}
	clientsCount := promauto.With(reg).NewGauge(prometheus.GaugeOpts{
		Name: "resource_server_clients",
		Help: "The current number of resource server clients in the pool.",
	})
	factoryRequestDuration := promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
		Name:    "resource_server_client_request_duration_seconds",
		Help:    "Time spent executing requests to resource server.",
		Buckets: prometheus.ExponentialBuckets(0.008, 4, 7),
	}, []string{"operation", "status_code"})

	factory := client.PoolInstFunc(func(inst ring.InstanceDesc) (client.PoolClient, error) {
		opts, err := clientCfg.DialOption(grpcclient.Instrument(factoryRequestDuration))
		if err != nil {
			return nil, err
		}

		conn, err := grpc.NewClient(inst.Addr, opts...)
		if err != nil {
			return nil, fmt.Errorf("failed to dial resource server %s %s: %s", inst.Id, inst.Addr, err)
		}

		// TODO only use this if FlagAppPlatformGrpcClientAuth is not enabled
		client := NewLegacyResourceClient(conn)

		return &ringClient{
			client:       client,
			HealthClient: grpc_health_v1.NewHealthClient(conn),
			conn:         conn,
		}, nil
	})

	return client.NewPool(ringName, poolCfg, nil, factory, clientsCount, log)
}
