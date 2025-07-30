package server

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/dskit/flagext"
	"github.com/grafana/dskit/grpcclient"
	"github.com/grafana/dskit/kv"
	"github.com/grafana/dskit/ring"
	ringclient "github.com/grafana/dskit/ring/client"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
)

var metricsPrefix = resource.RingName + "_"

func (ms *ModuleServer) initSearchServerRing() (services.Service, error) {
	if !ms.cfg.EnableSharding {
		return nil, nil
	}

	tracer := otel.Tracer(resource.RingKey)
	logger := log.New(resource.RingKey)
	reg := prometheus.WrapRegistererWithPrefix(metricsPrefix, ms.registerer)

	grpcclientcfg := &grpcclient.Config{}
	flagext.DefaultValues(grpcclientcfg)
	pool := newClientPool(*grpcclientcfg, logger, reg, ms.cfg, ms.features, tracer)

	ringStore, err := kv.NewClient(
		ms.MemberlistKVConfig,
		ring.GetCodec(),
		kv.RegistererWithKVName(reg, resource.RingName),
		logger,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create KV store client: %s", err)
	}

	searchServerRing, err := ring.NewWithStoreClientAndStrategy(
		toRingConfig(ms.cfg, ms.MemberlistKVConfig),
		resource.RingName,
		resource.RingKey,
		ringStore,
		ring.NewIgnoreUnhealthyInstancesReplicationStrategy(),
		reg,
		logger,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize index-server-ring ring: %s", err)
	}

	startFn := func(ctx context.Context) error {
		err = searchServerRing.StartAsync(ctx)
		if err != nil {
			return fmt.Errorf("failed to start the ring: %s", err)
		}
		err = pool.StartAsync(ctx)
		if err != nil {
			return fmt.Errorf("failed to start the ring client pool: %s", err)
		}

		return nil
	}

	ms.searchServerRing = searchServerRing
	ms.searchServerRingClientPool = pool

	ms.httpServerRouter.Path("/ring").Methods("GET", "POST").Handler(searchServerRing)

	svc := services.NewIdleService(startFn, nil)

	return svc, nil
}

func toRingConfig(cfg *setting.Cfg, KVStore kv.Config) ring.Config {
	rc := ring.Config{}
	flagext.DefaultValues(&rc)

	rc.KVStore = KVStore
	rc.HeartbeatTimeout = resource.RingHeartbeatTimeout

	rc.ReplicationFactor = cfg.SearchRingReplicationFactor

	return rc
}

func newClientPool(clientCfg grpcclient.Config, log log.Logger, reg prometheus.Registerer, cfg *setting.Cfg, features featuremgmt.FeatureToggles, tracer trace.Tracer) *ringclient.Pool {
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
		unaryInterceptors, streamInterceptors := grpcclient.Instrument(factoryRequestDuration)
		opts, err := clientCfg.DialOption(unaryInterceptors, streamInterceptors, nil)
		if err != nil {
			return nil, err
		}

		conn, err := grpc.NewClient(inst.Addr, opts...)
		if err != nil {
			return nil, fmt.Errorf("failed to dial resource server %s %s: %s", inst.Id, inst.Addr, err)
		}

		client := resource.NewAuthlessResourceClient(conn)

		return &resource.RingClient{
			Client:       client,
			HealthClient: grpc_health_v1.NewHealthClient(conn),
			Conn:         conn,
		}, nil
	})

	return ringclient.NewPool(resource.RingName, poolCfg, nil, factory, clientsCount, log)
}
