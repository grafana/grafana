package unified

import (
	"context"
	"fmt"
	"path/filepath"
	"time"

	"github.com/fullstorydev/grpchan"
	grpcUtils "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	otgrpc "github.com/opentracing-contrib/go-grpc"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"

	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/flagext"
	"github.com/grafana/dskit/grpcclient"
	"github.com/grafana/dskit/middleware"
	"github.com/grafana/dskit/services"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	infraDB "github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	secrets "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
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
	Cfg          *setting.Cfg
	Features     featuremgmt.FeatureToggles
	DB           infraDB.DB
	Tracer       tracing.Tracer
	Reg          prometheus.Registerer
	Authzc       types.AccessClient
	Docs         resource.DocumentBuilderSupplier
	SecureValues secrets.InlineSecureValueSupport
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
	apiserverCfg := opts.Cfg.SectionWithEnvOverrides("grafana-apiserver")
	client, err := newClient(options.StorageOptions{
		StorageType:             options.StorageType(apiserverCfg.Key("storage_type").MustString(string(options.StorageTypeUnified))),
		DataPath:                apiserverCfg.Key("storage_path").MustString(filepath.Join(opts.Cfg.DataPath, "grafana-apiserver")),
		Address:                 apiserverCfg.Key("address").MustString(""),
		SearchServerAddress:     apiserverCfg.Key("search_server_address").MustString(""),
		BlobStoreURL:            apiserverCfg.Key("blob_url").MustString(""),
		BlobThresholdBytes:      apiserverCfg.Key("blob_threshold_bytes").MustInt(options.BlobThresholdDefault),
		GrpcClientKeepaliveTime: apiserverCfg.Key("grpc_client_keepalive_time").MustDuration(0),
	}, opts.Cfg, opts.Features, opts.DB, opts.Tracer, opts.Reg, opts.Authzc, opts.Docs, storageMetrics, indexMetrics, opts.SecureValues)
	if err == nil {
		// Decide whether to disable SQL fallback stats per resource in Mode 5.
		// Otherwise we would still try to query the legacy SQL database in Mode 5.
		var disableDashboardsFallback, disableFoldersFallback bool
		if opts.Cfg != nil {
			// String are static here, so we don't need to import the packages.
			foldersMode := opts.Cfg.UnifiedStorage["folders.folder.grafana.app"].DualWriterMode
			disableFoldersFallback = foldersMode == grafanarest.Mode5
			dashboardsMode := opts.Cfg.UnifiedStorage["dashboards.dashboard.grafana.app"].DualWriterMode
			disableDashboardsFallback = dashboardsMode == grafanarest.Mode5
		}

		// Used to get the folder stats
		client = federated.NewFederatedClient(
			client, // The original
			legacysql.NewDatabaseProvider(opts.DB),
			disableDashboardsFallback,
			disableFoldersFallback,
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
	secure secrets.InlineSecureValueSupport,
) (resource.ResourceClient, error) {
	ctx := context.Background()

	switch opts.StorageType {
	case options.StorageTypeFile:
		backend, err := sql.NewFileBackend(cfg)
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

		conn, err = newGrpcConn(opts.Address, metrics, features, opts.GrpcClientKeepaliveTime)
		if err != nil {
			return nil, err
		}

		if opts.SearchServerAddress != "" {
			indexConn, err = newGrpcConn(opts.SearchServerAddress, metrics, features, opts.GrpcClientKeepaliveTime)

			if err != nil {
				return nil, err
			}
		} else {
			indexConn = conn
		}

		// Create a resource client
		return resource.NewResourceClient(conn, indexConn, cfg, features, tracer)

	default:
		searchOptions, err := search.NewSearchOptions(features, cfg, docs, indexMetrics, nil)
		if err != nil {
			return nil, err
		}

		backend, err := sql.NewStorageBackend(cfg, db, reg, storageMetrics, tracer, false)
		if err != nil {
			return nil, err
		}

		if backendService, ok := backend.(services.Service); ok {
			if err := services.StartAndAwaitRunning(ctx, backendService); err != nil {
				return nil, fmt.Errorf("failed to start storage backend: %w", err)
			}
		}

		serverOptions := sql.ServerOptions{
			Backend:       backend,
			Cfg:           cfg,
			Tracer:        tracer,
			Reg:           reg,
			AccessClient:  authzc,
			SearchOptions: searchOptions,
			IndexMetrics:  indexMetrics,
			Features:      features,
			SecureValues:  secure,
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

		// only enable if an overrides file path is provided
		if cfg.OverridesFilePath != "" {
			overridesSvc, err := resource.NewOverridesService(ctx, cfg.Logger, reg, tracer, resource.ReloadOptions{
				FilePath:     cfg.OverridesFilePath,
				ReloadPeriod: cfg.OverridesReloadInterval,
			})
			if err != nil {
				return nil, err
			}

			serverOptions.OverridesService = overridesSvc
		}

		server, err := sql.NewResourceServer(serverOptions)
		if err != nil {
			return nil, err
		}
		return resource.NewLocalResourceClient(server), nil
	}
}

func NewStorageApiSearchClient(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (resourcepb.ResourceIndexClient, error) {
	var searchClient resourcepb.ResourceIndexClient
	var err error
	if cfg.EnableSearchClient {
		searchClient, err = NewSearchClient(cfg, features)
		if err != nil {
			return nil, fmt.Errorf("failed to create search client: %w", err)
		}
	}
	return searchClient, nil
}

func NewSearchClient(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (resourcepb.ResourceIndexClient, error) {
	apiserverCfg := cfg.SectionWithEnvOverrides("grafana-apiserver")
	searchServerAddress := apiserverCfg.Key("search_server_address").MustString("")
	grpcClientKeepaliveTime := apiserverCfg.Key("grpc_client_keepalive_time").MustDuration(0)

	if searchServerAddress == "" {
		return nil, fmt.Errorf("expecting search_server_address to be set for search client under grafana-apiserver section")
	}

	var (
		conn    grpc.ClientConnInterface
		err     error
		metrics = newClientMetrics(prometheus.NewRegistry())
	)

	conn, err = newGrpcConn(searchServerAddress, metrics, features, grpcClientKeepaliveTime)
	if err != nil {
		return nil, err
	}

	cc := grpchan.InterceptClientConn(conn, grpcUtils.UnaryClientInterceptor, grpcUtils.StreamClientInterceptor)
	return resourcepb.NewResourceIndexClient(cc), nil
}

func newGrpcConn(address string, metrics *clientMetrics, features featuremgmt.FeatureToggles, clientKeepaliveTime time.Duration) (grpc.ClientConnInterface, error) {
	// Create either a connection pool or a single connection.
	// The connection pool __can__ be useful when connection to
	// server side load balancers like kube-proxy.
	//nolint:staticcheck // not yet migrated to OpenFeature
	if features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageGrpcConnectionPool) {
		conn, err := newPooledConn(&poolOpts{
			initialCapacity: 3,
			maxCapacity:     6,
			idleTimeout:     time.Minute,
			factory: func() (*grpc.ClientConn, error) {
				return grpcConn(address, metrics, clientKeepaliveTime)
			},
		})
		if err != nil {
			return nil, err
		}

		return conn, nil
	}

	conn, err := grpcConn(address, metrics, clientKeepaliveTime)
	if err != nil {
		return nil, err
	}

	return conn, nil
}

// grpcConn creates a new gRPC connection to the provided address.
func grpcConn(address string, metrics *clientMetrics, clientKeepaliveTime time.Duration) (*grpc.ClientConn, error) {
	// Report gRPC status code errors as labels.
	unary, stream := instrument(metrics.requestDuration, middleware.ReportGRPCStatusOption)

	// Add middleware to retry on transient connection issues. Note that
	// we do not implement it for streams, as we don't currently use streams.
	retryCfg := retryConfig{
		Max:           3,
		Backoff:       time.Second,
		BackoffJitter: 0.1,
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

	// Use round_robin to balance requests more evenly over the available Storage server.
	opts = append(opts, grpc.WithDefaultServiceConfig(`{"loadBalancingPolicy":"round_robin"}`))

	// Disable looking up service config from TXT DNS records.
	// This reduces the number of requests made to the DNS servers.
	opts = append(opts, grpc.WithDisableServiceConfig())

	opts = append(opts, connectionBackoffOptions())

	if clientKeepaliveTime > 0 {
		opts = append(opts, grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                clientKeepaliveTime,
			Timeout:             10 * time.Second,
			PermitWithoutStream: true,
		}))
	}
	// Create a connection to the gRPC server
	return grpc.NewClient(address, opts...)
}

// GrpcConn is the public constructor that can be used for testing.
// TODO: also use grpc_client_keepalive_time here.
func GrpcConn(address string, reg prometheus.Registerer) (*grpc.ClientConn, error) {
	metrics := newClientMetrics(reg)
	return grpcConn(address, metrics, 0)
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
