package install

import (
	"context"
	"fmt"
	"hash/fnv"
	"os"
	"sync"
	"time"

	kitlog "github.com/go-kit/log"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/dskit/dns"
	"github.com/grafana/dskit/flagext"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/kv/codec"
	"github.com/grafana/dskit/kv/memberlist"
	"github.com/grafana/dskit/netutil"
	"github.com/grafana/dskit/ring"
	"github.com/grafana/dskit/services"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
)

const (
	childReconcilerRingName = "plugins-child-reconciler"
	childReconcilerRingKey  = "plugins-child-reconciler"
)

var childReconcilerRingOp = ring.WriteNoExtend

type OwnershipFilter interface {
	OwnsPlugin(context.Context, *pluginsv0alpha1.Plugin) (bool, error)
}

type noopOwnershipFilter struct{}

func NewNoopOwnershipFilter() OwnershipFilter {
	return noopOwnershipFilter{}
}

func (noopOwnershipFilter) OwnsPlugin(context.Context, *pluginsv0alpha1.Plugin) (bool, error) {
	return true, nil
}

type HashRingOwnershipFilterConfig struct {
	InstanceID         string
	InstanceAddr       string
	NumTokens          int
	HeartbeatPeriod    time.Duration
	HeartbeatTimeout   time.Duration
	RejoinInterval     time.Duration
	MemberlistBindAddr string
	MemberlistBindPort int

	MemberlistAdvertiseAddr string
	MemberlistAdvertisePort int

	MemberlistJoinMembers []string
	AbortIfJoinFails      bool

	MemberlistClusterLabel                     string
	MemberlistClusterLabelVerificationDisabled bool
}

type ownershipReadRing interface {
	GetWithOptions(key uint32, op ring.Operation, opts ...ring.Option) (ring.ReplicationSet, error)
	State() services.State
}

type ownershipInstance interface {
	GetInstanceAddr() string
}

type HashRingOwnershipFilter struct {
	readRing  ownershipReadRing
	instance  ownershipInstance
	manager   *services.Manager
	ready     chan struct{}
	readyOnce sync.Once
}

func NewHashRingOwnershipFilter(cfg HashRingOwnershipFilterConfig, logger kitlog.Logger, reg prometheus.Registerer) (*HashRingOwnershipFilter, error) {
	if err := cfg.validate(); err != nil {
		return nil, err
	}

	memberlistCfg := &memberlist.KVConfig{}
	flagext.DefaultValues(memberlistCfg)
	memberlistCfg.Codecs = []codec.Codec{ring.GetCodec()}
	memberlistCfg.ClusterLabel = cfg.MemberlistClusterLabel
	memberlistCfg.ClusterLabelVerificationDisabled = cfg.MemberlistClusterLabelVerificationDisabled
	memberlistCfg.JoinMembers = cfg.MemberlistJoinMembers
	memberlistCfg.AbortIfJoinFails = cfg.AbortIfJoinFails
	memberlistCfg.RejoinInterval = cfg.RejoinInterval
	memberlistCfg.AdvertiseAddr = cfg.MemberlistAdvertiseAddr
	memberlistCfg.AdvertisePort = cfg.MemberlistAdvertisePort
	memberlistCfg.TCPTransport.BindPort = cfg.MemberlistBindPort
	if cfg.MemberlistBindAddr != "" {
		memberlistCfg.TCPTransport.BindAddrs = []string{cfg.MemberlistBindAddr}
	}

	dnsProviderReg := prometheus.WrapRegistererWith(prometheus.Labels{
		"component": childReconcilerRingName,
	}, reg)
	dnsProvider := dns.NewProvider(logger, dnsProviderReg, dns.GolangResolverType)

	memberlistService := memberlist.NewKVInitService(memberlistCfg, logger, dnsProvider, reg)

	ringStoreCfg := kv.Config{Store: "memberlist"}
	ringStoreCfg.MemberlistKV = memberlistService.GetMemberlistKV

	ringStore, err := kv.NewClient(
		ringStoreCfg,
		ring.GetCodec(),
		kv.RegistererWithKVName(reg, childReconcilerRingName),
		logger,
	)
	if err != nil {
		return nil, fmt.Errorf("create child reconciler ring KV client: %w", err)
	}

	readRing, err := ring.NewWithStoreClientAndStrategy(
		ring.Config{
			KVStore:           ringStoreCfg,
			HeartbeatTimeout:  cfg.HeartbeatTimeout,
			ReplicationFactor: 1,
		},
		childReconcilerRingName,
		childReconcilerRingKey,
		ringStore,
		ring.NewIgnoreUnhealthyInstancesReplicationStrategy(),
		reg,
		logger,
	)
	if err != nil {
		return nil, fmt.Errorf("create child reconciler ring: %w", err)
	}

	instanceAddr, err := cfg.resolveInstanceAddr(logger)
	if err != nil {
		return nil, err
	}

	delegate := ring.BasicLifecyclerDelegate(ring.NewInstanceRegisterDelegate(ring.ACTIVE, cfg.NumTokens))
	delegate = ring.NewLeaveOnStoppingDelegate(delegate, logger)
	delegate = ring.NewAutoForgetDelegate(cfg.HeartbeatTimeout*2, delegate, logger)

	lifecycler, err := ring.NewBasicLifecycler(
		ring.BasicLifecyclerConfig{
			ID:               cfg.instanceID(),
			Addr:             fmt.Sprintf("%s:%d", instanceAddr, cfg.instancePort()),
			HeartbeatPeriod:  cfg.HeartbeatPeriod,
			HeartbeatTimeout: cfg.HeartbeatTimeout,
			NumTokens:        cfg.NumTokens,
		},
		childReconcilerRingName,
		childReconcilerRingKey,
		ringStore,
		delegate,
		logger,
		reg,
	)
	if err != nil {
		return nil, fmt.Errorf("create child reconciler lifecycler: %w", err)
	}

	manager, err := services.NewManager(memberlistService, readRing, lifecycler)
	if err != nil {
		return nil, fmt.Errorf("create child reconciler sharding manager: %w", err)
	}

	return &HashRingOwnershipFilter{
		readRing: readRing,
		instance: lifecycler,
		manager:  manager,
		ready:    make(chan struct{}),
	}, nil
}

func (f *HashRingOwnershipFilter) Run(ctx context.Context) error {
	if err := services.StartManagerAndAwaitHealthy(ctx, f.manager); err != nil {
		return err
	}
	f.readyOnce.Do(func() {
		close(f.ready)
	})

	<-ctx.Done()

	stopCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	return services.StopManagerAndAwaitStopped(stopCtx, f.manager)
}

func (f *HashRingOwnershipFilter) WaitUntilReady(ctx context.Context) error {
	if f == nil {
		return fmt.Errorf("ownership filter is required")
	}
	if f.ready == nil {
		return nil
	}

	select {
	case <-f.ready:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (f *HashRingOwnershipFilter) OwnsPlugin(_ context.Context, plugin *pluginsv0alpha1.Plugin) (bool, error) {
	if plugin == nil {
		return false, fmt.Errorf("plugin is required")
	}
	if state := f.readRing.State(); state != services.Running {
		return false, fmt.Errorf("child reconciler ring is not running: %s", state)
	}

	replicationSet, err := f.readRing.GetWithOptions(hashChildReconcilerShardKey(plugin), childReconcilerRingOp)
	if err != nil {
		return false, fmt.Errorf("resolve child reconciler shard owner: %w", err)
	}

	return replicationSet.Includes(f.instance.GetInstanceAddr()), nil
}

func (cfg HashRingOwnershipFilterConfig) validate() error {
	if cfg.NumTokens <= 0 {
		return fmt.Errorf("child reconciler sharding num tokens must be greater than zero")
	}
	if cfg.HeartbeatPeriod <= 0 {
		return fmt.Errorf("child reconciler sharding heartbeat period must be greater than zero")
	}
	if cfg.HeartbeatTimeout <= 0 {
		return fmt.Errorf("child reconciler sharding heartbeat timeout must be greater than zero")
	}
	if cfg.instancePort() <= 0 {
		return fmt.Errorf("child reconciler sharding memberlist port must be greater than zero")
	}

	return nil
}

func (cfg HashRingOwnershipFilterConfig) instanceID() string {
	if cfg.InstanceID != "" {
		return cfg.InstanceID
	}

	hostname, err := os.Hostname()
	if err != nil {
		return childReconcilerRingName
	}

	return hostname
}

func (cfg HashRingOwnershipFilterConfig) instancePort() int {
	if cfg.MemberlistAdvertisePort > 0 {
		return cfg.MemberlistAdvertisePort
	}

	return cfg.MemberlistBindPort
}

func (cfg HashRingOwnershipFilterConfig) resolveInstanceAddr(logger kitlog.Logger) (string, error) {
	instanceAddr := cfg.InstanceAddr
	if instanceAddr == "" {
		instanceAddr = cfg.MemberlistAdvertiseAddr
	}

	addr, err := ring.GetInstanceAddr(
		instanceAddr,
		netutil.PrivateNetworkInterfacesWithFallback([]string{"eth0", "en0"}, logger),
		logger,
		true,
	)
	if err != nil {
		return "", fmt.Errorf("resolve child reconciler instance address: %w", err)
	}

	return addr, nil
}

func hashChildReconcilerShardKey(plugin *pluginsv0alpha1.Plugin) uint32 {
	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(plugin.Namespace))
	_, _ = hasher.Write([]byte("/"))
	_, _ = hasher.Write([]byte(plugin.Name))
	return hasher.Sum32()
}
