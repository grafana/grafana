package unified

import (
	"context"
	"fmt"
	"path/filepath"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"gocloud.dev/blob/fileblob"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	otgrpc "github.com/opentracing-contrib/go-grpc"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/flagext"
	"github.com/grafana/dskit/grpcclient"
	"github.com/grafana/dskit/middleware"
	"github.com/grafana/dskit/services"

	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/federated"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/util/scheduler"
)

type Options struct {
	Cfg      *setting.Cfg
	Features featuremgmt.FeatureToggles
	DB       infraDB.DB
	Tracer   tracing.Tracer
	Reg      prometheus.Registerer
	Authzc   types.AccessClient
	Docs     resource.DocumentBuilderSupplier
}

type clientMetrics struct {
	requestDuration *prometheus.HistogramVec
	requestRetries  *prometheus.CounterVec
}

// This adds a UnifiedStorage client into the wire dependency tree
func ProvideUnifiedStorageClient(opts *Options,
	storageMetrics *resource.StorageMetrics,
	indexMetrics *resource.BleveIndexMetrics,
) (resource.ResourceClient, error) {
	// See: apiserver.applyAPIServerConfig(cfg, features, o)
	apiserverCfg := opts.Cfg.SectionWithEnvOverrides("grafana-apiserver")
	client, err := newClient(options.StorageOptions{
		StorageType:         options.StorageType(apiserverCfg.Key("storage_type").MustString(string(options.StorageTypeUnified))),
		DataPath:            apiserverCfg.Key("storage_path").MustString(filepath.Join(opts.Cfg.DataPath, "grafana-apiserver")),
		Address:             apiserverCfg.Key("address").MustString(""),
		SearchServerAddress: apiserverCfg.Key("search_server_address").MustString(""),
		BlobStoreURL:        apiserverCfg.Key("blob_url").MustString(""),
		BlobThresholdBytes:  apiserverCfg.Key("blob_threshold_bytes").MustInt(options.BlobThresholdDefault),
	}, opts.Cfg, opts.Features, opts.DB, opts.Tracer, opts.Reg, opts.Authzc, opts.Docs, storageMetrics, indexMetrics)
	if err == nil {
		// Used to get the folder stats
		client = federated.NewFederatedClient(
			client, // The original
			legacysql.NewDatabaseProvider(opts.DB),
		)
	}

	return client, err
}

func newClient(opts options.StorageOptions,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	db infraDB.DB,
	tracer tracing.Tracer,
	reg prometheus.Registerer,
	authzc types.AccessClient,
	docs resource.DocumentBuilderSupplier,
	storageMetrics *resource.StorageMetrics,
	indexMetrics *resource.BleveIndexMetrics,
) (resource.ResourceClient, error) {
	ctx := context.Background()

	switch opts.StorageType {
	case options.StorageTypeFile:
		if opts.DataPath == "" {
			opts.DataPath = filepath.Join(cfg.DataPath, "grafana-apiserver")
		}
		bucket, err := fileblob.OpenBucket(filepath.Join(opts.DataPath, "resource"), &fileblob.Options{
			CreateDir: true,
			Metadata:  fileblob.MetadataDontWrite, // skip
		})
		if err != nil {
			return nil, err
		}
		backend, err := resource.NewCDKBackend(ctx, resource.CDKBackendOptions{
			Bucket: bucket,
		})
		if err != nil {
			return nil, err
		}
		server, err := resource.NewResourceServer(resource.ResourceServerOptions{
			Backend: backend,
			Blob: resource.BlobConfig{
				URL: opts.BlobStoreURL,
			},
		})
		if err != nil {
			return nil, err
		}
		return resource.NewLocalResourceClient(server), nil

	case options.StorageTypeUnifiedGrpc:
		if opts.Address == "" {
			return nil, fmt.Errorf("expecting address for storage_type: %s", opts.StorageType)
		}

		var (
			conn      grpc.ClientConnInterface
			indexConn grpc.ClientConnInterface
			err       error
			metrics   = newClientMetrics(reg)
		)

		conn, err = newGrpcConn(opts.Address, metrics, features)
		if err != nil {
			return nil, err
		}

		if opts.SearchServerAddress != "" {
			indexConn, err = newGrpcConn(opts.SearchServerAddress, metrics, features)

			if err != nil {
				return nil, err
			}
		} else {
			indexConn = conn
		}

		// Create a client instance
		client, err := resource.NewResourceClient(conn, indexConn, cfg, features, tracer)
		if err != nil {
			return nil, err
		}
		return client, nil

	default:
		searchOptions, err := search.NewSearchOptions(features, cfg, tracer, docs, indexMetrics)
		if err != nil {
			return nil, err
		}

		serverOptions := sql.ServerOptions{
			DB:             db,
			Cfg:            cfg,
			Tracer:         tracer,
			Reg:            reg,
			AccessClient:   authzc,
			SearchOptions:  searchOptions,
			StorageMetrics: storageMetrics,
			IndexMetrics:   indexMetrics,
			Features:       features,
		}

		if cfg.QOSEnabled {
			qosReg := prometheus.WrapRegistererWithPrefix("resource_server_qos_", reg)
			queue := scheduler.NewQueue(&scheduler.QueueOptions{
				MaxSizePerTenant: cfg.QOSMaxSizePerTenant,
				Registerer:       qosReg,
				Logger:           cfg.Logger,
			})
			if err := services.StartAndAwaitRunning(ctx, queue); err != nil {
				return nil, fmt.Errorf("failed to start queue: %w", err)
			}
			scheduler, err := scheduler.NewScheduler(queue, &scheduler.Config{
				NumWorkers: cfg.QOSNumberWorker,
				Logger:     cfg.Logger,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to create scheduler: %w", err)
			}

			err = services.StartAndAwaitRunning(ctx, scheduler)
			if err != nil {
				return nil, fmt.Errorf("failed to start scheduler: %w", err)
			}
			serverOptions.QOSQueue = queue
		}

		server, err := sql.NewResourceServer(serverOptions)
		if err != nil {
			return nil, err
		}
		return resource.NewLocalResourceClient(server), nil
	}
}

func newGrpcConn(address string, metrics *clientMetrics, features featuremgmt.FeatureToggles) (grpc.ClientConnInterface, error) {
	// Create either a connection pool or a single connection.
	// The connection pool __can__ be useful when connection to
	// server side load balancers like kube-proxy.
	if features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageGrpcConnectionPool) {
		conn, err := newPooledConn(&poolOpts{
			initialCapacity: 3,
			maxCapacity:     6,
			idleTimeout:     time.Minute,
			factory: func() (*grpc.ClientConn, error) {
				return grpcConn(address, metrics)
			},
		})
		if err != nil {
			return nil, err
		}

		return conn, nil
	}

	conn, err := grpcConn(address, metrics)
	if err != nil {
		return nil, err
	}

	return conn, nil
}

// grpcConn creates a new gRPC connection to the provided address.
func grpcConn(address string, metrics *clientMetrics) (*grpc.ClientConn, error) {
	// Report gRPC status code errors as labels.
	unary, stream := instrument(metrics.requestDuration, middleware.ReportGRPCStatusOption)

	// Add middleware to retry on transient connection issues. Note that
	// we do not implement it for streams, as we don't currently use streams.
	retryCfg := retryConfig{
		Max:           3,
		Backoff:       time.Second,
		BackoffJitter: 0.5,
	}
	unary = append(unary, unaryRetryInterceptor(retryCfg))
	unary = append(unary, unaryRetryInstrument(metrics.requestRetries))

	cfg := grpcclient.Config{}
	// Set the defaults that are normally set by Config.RegisterFlags.
	flagext.DefaultValues(&cfg)

	opts, err := cfg.DialOption(unary, stream, nil)
	if err != nil {
		return nil, fmt.Errorf("could not instrument grpc client: %w", err)
	}

	opts = append(opts, grpc.WithStatsHandler(otelgrpc.NewClientHandler()))
	opts = append(opts, grpc.WithTransportCredentials(insecure.NewCredentials()))

	// Use round_robin to balances requests more evenly over the available Storage server.
	opts = append(opts, grpc.WithDefaultServiceConfig(`{"loadBalancingPolicy":"round_robin"}`))

	// Disable looking up service config from TXT DNS records.
	// This reduces the number of requests made to the DNS servers.
	opts = append(opts, grpc.WithDisableServiceConfig())

	// Create a connection to the gRPC server
	return grpc.NewClient(address, opts...)
}

// GrpcConn is the public constructor that can be used for testing.
func GrpcConn(address string, reg prometheus.Registerer) (*grpc.ClientConn, error) {
	metrics := newClientMetrics(reg)
	return grpcConn(address, metrics)
}

// instrument is the same as grpcclient.Instrument but without the middleware.ClientUserHeaderInterceptor
// and middleware.StreamClientUserHeaderInterceptor as we don't need them.
func instrument(requestDuration *prometheus.HistogramVec, instrumentationLabelOptions ...middleware.InstrumentationOption) ([]grpc.UnaryClientInterceptor, []grpc.StreamClientInterceptor) {
	return []grpc.UnaryClientInterceptor{
			otgrpc.OpenTracingClientInterceptor(opentracing.GlobalTracer()),
			middleware.UnaryClientInstrumentInterceptor(requestDuration, instrumentationLabelOptions...),
		}, []grpc.StreamClientInterceptor{
			otgrpc.OpenTracingStreamClientInterceptor(opentracing.GlobalTracer()),
			middleware.StreamClientInstrumentInterceptor(requestDuration, instrumentationLabelOptions...),
		}
}

func newClientMetrics(reg prometheus.Registerer) *clientMetrics {
	// This works for now as the Provide function is only called once during startup.
	// We might eventually want to tight this factory to a struct for more runtime control.
	return &clientMetrics{
		requestDuration: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:    "resource_server_client_request_duration_seconds",
			Help:    "Time spent executing requests to the resource server.",
			Buckets: prometheus.ExponentialBuckets(0.008, 4, 7),
		}, []string{"operation", "status_code"}),
		requestRetries: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Name: "resource_server_client_request_retries_total",
			Help: "Total number of retries for requests to the resource server.",
		}, []string{"operation"}),
	}
}
