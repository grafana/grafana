package server

import (
	"context"
	"fmt"
	"net"
	"os"
	"strconv"
	"time"

	"github.com/grafana/dskit/flagext"
	"github.com/grafana/dskit/grpcclient"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/netutil"
	"github.com/grafana/dskit/ring"
	ringclient "github.com/grafana/dskit/ring/client"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
)

const ringKey = "storage-ring"
const ringName = "unified_storage"
const numTokens = 128
const heartbeatTimeout = time.Minute

var metricsPrefix = ringName + "_"

func (ms *ModuleServer) initRing() (services.Service, error) {
	if !ms.cfg.EnableSharding {
		return nil, nil
	}

	logger := log.New("resource-server-ring")
	reg := prometheus.WrapRegistererWithPrefix(metricsPrefix, ms.registerer)

	grpcclientcfg := &grpcclient.Config{}
	flagext.DefaultValues(grpcclientcfg)
	pool := newClientPool(*grpcclientcfg, logger, reg)

	ringStore, err := kv.NewClient(
		ms.MemberlistKVConfig,
		ring.GetCodec(),
		kv.RegistererWithKVName(reg, ringName),
		logger,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create KV store client: %s", err)
	}

	lifecyclerCfg, err := toLifecyclerConfig(ms.cfg, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize storage-ring lifecycler config: %s", err)
	}

	// Define lifecycler delegates in reverse order (last to be called defined first because they're
	// chained via "next delegate").
	delegate := ring.BasicLifecyclerDelegate(ring.NewInstanceRegisterDelegate(ring.JOINING, numTokens))
	delegate = ring.NewLeaveOnStoppingDelegate(delegate, logger)
	delegate = ring.NewAutoForgetDelegate(heartbeatTimeout*2, delegate, logger)

	lifecycler, err := ring.NewBasicLifecycler(
		lifecyclerCfg,
		ringName,
		ringKey,
		ringStore,
		delegate,
		logger,
		reg,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize storage-ring lifecycler: %s", err)
	}

	storageRing, err := ring.NewWithStoreClientAndStrategy(
		toRingConfig(ms.cfg, ms.MemberlistKVConfig),
		ringName,
		ringKey,
		ringStore,
		ring.NewIgnoreUnhealthyInstancesReplicationStrategy(),
		reg,
		logger,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize storage-ring ring: %s", err)
	}

	startFn := func(ctx context.Context) error {
		err = storageRing.StartAsync(ctx)
		if err != nil {
			return fmt.Errorf("failed to start the ring: %s", err)
		}
		err = lifecycler.StartAsync(ctx)
		if err != nil {
			return fmt.Errorf("failed to start the lifecycler: %s", err)
		}
		err = pool.StartAsync(ctx)
		if err != nil {
			return fmt.Errorf("failed to start the ring client pool: %s", err)
		}

		logger.Info("waiting until resource server is JOINING in the ring")
		ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
		defer cancel()
		if err := ring.WaitInstanceState(ctx, storageRing, lifecycler.GetInstanceID(), ring.JOINING); err != nil {
			return fmt.Errorf("error switching to JOINING in the ring: %s", err)
		}
		logger.Info("resource server is JOINING in the ring")

		if err := lifecycler.ChangeState(ctx, ring.ACTIVE); err != nil {
			return fmt.Errorf("error switching to ACTIVE in the ring: %s", err)
		}
		logger.Info("resource server is ACTIVE in the ring")

		return nil
	}

	ms.distributor = &resource.Distributor{
		ClientPool: pool,
		Ring:       storageRing,
		Lifecycler: lifecycler,
	}

	ms.httpServerRouter.Path("/ring").Methods("GET", "POST").Handler(storageRing)

	svc := services.NewIdleService(startFn, nil)

	return svc, nil
}

func toLifecyclerConfig(cfg *setting.Cfg, logger log.Logger) (ring.BasicLifecyclerConfig, error) {
	instanceAddr, err := ring.GetInstanceAddr(cfg.MemberlistBindAddr, netutil.PrivateNetworkInterfacesWithFallback([]string{"eth0", "en0"}, logger), logger, true)
	if err != nil {
		return ring.BasicLifecyclerConfig{}, err
	}

	instanceId := cfg.InstanceID
	if instanceId == "" {
		hostname, err := os.Hostname()
		if err != nil {
			return ring.BasicLifecyclerConfig{}, err
		}

		instanceId = hostname
	}

	_, grpcPortStr, err := net.SplitHostPort(cfg.GRPCServer.Address)
	if err != nil {
		return ring.BasicLifecyclerConfig{}, fmt.Errorf("could not get grpc port from grpc server address: %s", err)
	}

	grpcPort, err := strconv.Atoi(grpcPortStr)
	if err != nil {
		return ring.BasicLifecyclerConfig{}, fmt.Errorf("error converting grpc address port to int: %s", err)
	}

	return ring.BasicLifecyclerConfig{
		Addr:                fmt.Sprintf("%s:%d", instanceAddr, grpcPort),
		ID:                  instanceId,
		HeartbeatPeriod:     15 * time.Second,
		HeartbeatTimeout:    heartbeatTimeout,
		TokensObservePeriod: 0,
		NumTokens:           numTokens,
	}, nil
}

func toRingConfig(cfg *setting.Cfg, KVStore kv.Config) ring.Config {
	rc := ring.Config{}
	flagext.DefaultValues(&rc)

	rc.KVStore = KVStore
	rc.HeartbeatTimeout = heartbeatTimeout

	rc.ReplicationFactor = 1

	return rc
}

func newClientPool(clientCfg grpcclient.Config, log log.Logger, reg prometheus.Registerer) *ringclient.Pool {
	poolCfg := ringclient.PoolConfig{
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

	factory := ringclient.PoolInstFunc(func(inst ring.InstanceDesc) (ringclient.PoolClient, error) {
		opts, err := clientCfg.DialOption(grpcclient.Instrument(factoryRequestDuration))
		if err != nil {
			return nil, err
		}

		conn, err := grpc.NewClient(inst.Addr, opts...)
		if err != nil {
			return nil, fmt.Errorf("failed to dial resource server %s %s: %s", inst.Id, inst.Addr, err)
		}

		// TODO only use this if FlagAppPlatformGrpcClientAuth is not enabled
		client := resource.NewLegacyResourceClient(conn)

		return &resource.RingClient{
			Client:       client,
			HealthClient: grpc_health_v1.NewHealthClient(conn),
			Conn:         conn,
		}, nil
	})

	return ringclient.NewPool(ringName, poolCfg, nil, factory, clientsCount, log)
}
