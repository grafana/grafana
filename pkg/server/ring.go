package server

import (
	"context"
	"fmt"
	"strconv"
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
	grpc_retry "github.com/grpc-ecosystem/go-grpc-middleware/retry"
	"github.com/grpc-ecosystem/go-grpc-middleware/util/metautils"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/backoff"
	"google.golang.org/grpc/codes"
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
	factoryRequestRetries := promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
		Name: "resource_server_client_request_retries_total",
		Help: "Total number of retries for requests to the resource server.",
	}, []string{"operation"})

	factory := ringclient.PoolInstFunc(func(inst ring.InstanceDesc) (ringclient.PoolClient, error) {
		unaryInterceptors, streamInterceptors := grpcclient.Instrument(factoryRequestDuration)

		// Add retry interceptors for transient connection issues
		unaryInterceptors = append(unaryInterceptors, ringClientRetryInterceptor())
		unaryInterceptors = append(unaryInterceptors, ringClientRetryInstrument(factoryRequestRetries))

		opts, err := clientCfg.DialOption(unaryInterceptors, streamInterceptors, nil)
		if err != nil {
			return nil, err
		}

		opts = append(opts, connectionBackoffOptions())

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

// ringClientRetryInterceptor creates an interceptor to perform retries for unary methods.
// It retries on ResourceExhausted and Unavailable codes, which are typical for
// transient connection issues and rate limiting.
func ringClientRetryInterceptor() grpc.UnaryClientInterceptor {
	return grpc_retry.UnaryClientInterceptor(
		grpc_retry.WithMax(3),
		grpc_retry.WithBackoff(grpc_retry.BackoffExponentialWithJitter(time.Second, 0.1)),
		grpc_retry.WithCodes(codes.ResourceExhausted, codes.Unavailable),
	)
}

// ringClientRetryInstrument creates an interceptor to count retry attempts for metrics.
func ringClientRetryInstrument(metric *prometheus.CounterVec) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, resp interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		// We can tell if a call is a retry by checking the retry attempt metadata.
		attempt, err := strconv.Atoi(metautils.ExtractOutgoing(ctx).Get(grpc_retry.AttemptMetadataKey))
		if err == nil && attempt > 0 {
			metric.WithLabelValues(method).Inc()
		}
		return invoker(ctx, method, req, resp, cc, opts...)
	}
}

// connectionBackoffOptions configures connection backoff parameters for faster recovery from
// transient connection failures (e.g., during pod restarts).
func connectionBackoffOptions() grpc.DialOption {
	return grpc.WithConnectParams(grpc.ConnectParams{
		Backoff: backoff.Config{
			BaseDelay:  100 * time.Millisecond,
			Multiplier: 1.6,
			Jitter:     0.2,
			MaxDelay:   10 * time.Second,
		},
		MinConnectTimeout: 5 * time.Second,
	})
}
