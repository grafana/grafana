package resource

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/trace"
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
	"github.com/pkg/errors"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
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

	return ring.BasicLifecyclerConfig{
		ID:                  cfg.InstanceID,
		Addr:                fmt.Sprintf("%s:%d", instanceAddr, instancePort),
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

func initRing(cfg ShardingConfig, logger log.Logger, registerer prometheus.Registerer) (*ring.Ring, *ring.BasicLifecycler, error) {
	if cfg.MemberlistJoinMember == "" {
		return nil, nil, fmt.Errorf("bad sharding configuration. Missing Join Member")
	}

	resourceRingConfig := &resourceRingConfig{
		KVStore:                kv.Config{Store: "memberlist"},
		HeartbeatPeriod:        15 * time.Second,
		HeartbeatTimeout:       time.Minute,
		InstanceInterfaceNames: netutil.PrivateNetworkInterfacesWithFallback([]string{"eth0", "en0"}, log.NewNopLogger()),
		InstanceAddr:           cfg.MemberlistBindAddr,
		InstanceID:             cfg.MemberlistBindAddr,
		ListenPort:             cfg.RingListenPort,
		InstancePort:           cfg.RingListenPort,
		NumTokens:              128,
	}

	memberlistKVcfg := &memberlist.KVConfig{}
	flagext.DefaultValues(memberlistKVcfg)
	memberlistKVcfg.MetricsNamespace = ringName
	memberlistKVcfg.Codecs = []codec.Codec{
		ring.GetCodec(),
	}
	memberlistKVcfg.AdvertiseAddr = cfg.MemberlistBindAddr
	memberlistKVcfg.TCPTransport.BindAddrs = []string{cfg.MemberlistBindAddr}
	memberlistKVcfg.NodeName = cfg.MemberlistBindAddr
	memberlistKVcfg.JoinMembers = []string{cfg.MemberlistJoinMember}

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
	resourceRingConfig.KVStore.MemberlistKV = memberlistKVsvc.GetMemberlistKV

	ringStore, err := kv.NewClient(
		resourceRingConfig.KVStore,
		ring.GetCodec(),
		kv.RegistererWithKVName(prometheus.WrapRegistererWithPrefix(metricsPrefix, registerer), "ruler"),
		logger,
	)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to create KV store client")
	}

	lifecyclerCfg, err := resourceRingConfig.toLifecyclerConfig(logger)
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to initialize ruler's lifecycler config")
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
		return nil, nil, errors.Wrap(err, "failed to initialize ruler's lifecycler")
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
		return nil, nil, errors.Wrap(err, "failed to initialize ruler's ring")
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
			return nil, errors.Wrapf(err, "failed to dial resource server %s %s", inst.Id, inst.Addr)
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
