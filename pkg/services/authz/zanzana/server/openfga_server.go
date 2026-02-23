package server

import (
	"context"
	"fmt"
	"net/http"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	httpmiddleware "github.com/openfga/openfga/pkg/middleware/http"
	"github.com/openfga/openfga/pkg/server"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/storage"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/rs/cors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	healthv1pb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"

	zlogger "github.com/grafana/grafana/pkg/services/authz/zanzana/logger"
)

func NewOpenFGAServer(cfg setting.ZanzanaServerSettings, store storage.OpenFGADatastore) (*server.Server, error) {
	logger := log.New("openfga.server")

	opts := []server.OpenFGAServiceV1Option{ //nolint:prealloc
		server.WithDatastore(store),
		server.WithLogger(zlogger.New(logger)),

		// Cache settings
		server.WithCheckCacheLimit(cfg.CacheSettings.CheckCacheLimit),
		server.WithCacheControllerEnabled(cfg.CacheSettings.CacheControllerEnabled),
		server.WithCacheControllerTTL(cfg.CacheSettings.CacheControllerTTL),
		server.WithCheckQueryCacheEnabled(cfg.CacheSettings.CheckQueryCacheEnabled),
		server.WithCheckQueryCacheTTL(cfg.CacheSettings.CheckQueryCacheTTL),
		server.WithCheckIteratorCacheEnabled(cfg.CacheSettings.CheckIteratorCacheEnabled),
		server.WithCheckIteratorCacheMaxResults(cfg.CacheSettings.CheckIteratorCacheMaxResults),
		server.WithCheckIteratorCacheTTL(cfg.CacheSettings.CheckIteratorCacheTTL),

		// ListObjects settings
		server.WithListObjectsMaxResults(cfg.ListObjectsMaxResults),
		server.WithListObjectsIteratorCacheEnabled(cfg.CacheSettings.ListObjectsIteratorCacheEnabled),
		server.WithListObjectsIteratorCacheMaxResults(cfg.CacheSettings.ListObjectsIteratorCacheMaxResults),
		server.WithListObjectsIteratorCacheTTL(cfg.CacheSettings.ListObjectsIteratorCacheTTL),
		server.WithListObjectsDeadline(cfg.ListObjectsDeadline),

		// Shared iterator settings
		server.WithSharedIteratorEnabled(cfg.CacheSettings.SharedIteratorEnabled),
		server.WithSharedIteratorLimit(cfg.CacheSettings.SharedIteratorLimit),
		server.WithSharedIteratorTTL(cfg.CacheSettings.SharedIteratorTTL),

		server.WithContextPropagationToDatastore(true),
	}

	openfgaOpts := withOpenFGAOptions(cfg)
	opts = append(opts, openfgaOpts...)

	srv, err := server.NewServerWithOpts(opts...)
	if err != nil {
		return nil, err
	}

	return srv, nil
}

func withOpenFGAOptions(cfg setting.ZanzanaServerSettings) []server.OpenFGAServiceV1Option {
	opts := make([]server.OpenFGAServiceV1Option, 0)

	listOpts := withListOptions(cfg)
	opts = append(opts, listOpts...)

	// Check settings
	if cfg.OpenFgaServerSettings.MaxConcurrentReadsForCheck != 0 {
		opts = append(opts, server.WithMaxConcurrentReadsForCheck(cfg.OpenFgaServerSettings.MaxConcurrentReadsForCheck))
	}
	if cfg.OpenFgaServerSettings.CheckDatabaseThrottleThreshold != 0 || cfg.OpenFgaServerSettings.CheckDatabaseThrottleDuration != 0 {
		opts = append(opts, server.WithCheckDatabaseThrottle(cfg.OpenFgaServerSettings.CheckDatabaseThrottleThreshold, cfg.OpenFgaServerSettings.CheckDatabaseThrottleDuration))
	}

	// Batch check settings
	if cfg.OpenFgaServerSettings.MaxConcurrentChecksPerBatchCheck != 0 {
		opts = append(opts, server.WithMaxConcurrentChecksPerBatchCheck(cfg.OpenFgaServerSettings.MaxConcurrentChecksPerBatchCheck))
	}
	if cfg.OpenFgaServerSettings.MaxChecksPerBatchCheck != 0 {
		opts = append(opts, server.WithMaxChecksPerBatchCheck(cfg.OpenFgaServerSettings.MaxChecksPerBatchCheck))
	}

	// Resolve node settings
	if cfg.OpenFgaServerSettings.ResolveNodeLimit != 0 {
		opts = append(opts, server.WithResolveNodeLimit(cfg.OpenFgaServerSettings.ResolveNodeLimit))
	}
	if cfg.OpenFgaServerSettings.ResolveNodeBreadthLimit != 0 {
		opts = append(opts, server.WithResolveNodeBreadthLimit(cfg.OpenFgaServerSettings.ResolveNodeBreadthLimit))
	}

	// Dispatch throttling settings
	if cfg.OpenFgaServerSettings.DispatchThrottlingCheckResolverEnabled {
		opts = append(opts, server.WithDispatchThrottlingCheckResolverEnabled(cfg.OpenFgaServerSettings.DispatchThrottlingCheckResolverEnabled))
	}
	if cfg.OpenFgaServerSettings.DispatchThrottlingCheckResolverFrequency != 0 {
		opts = append(opts, server.WithDispatchThrottlingCheckResolverFrequency(cfg.OpenFgaServerSettings.DispatchThrottlingCheckResolverFrequency))
	}
	if cfg.OpenFgaServerSettings.DispatchThrottlingCheckResolverThreshold != 0 {
		opts = append(opts, server.WithDispatchThrottlingCheckResolverThreshold(cfg.OpenFgaServerSettings.DispatchThrottlingCheckResolverThreshold))
	}
	if cfg.OpenFgaServerSettings.DispatchThrottlingCheckResolverMaxThreshold != 0 {
		opts = append(opts, server.WithDispatchThrottlingCheckResolverMaxThreshold(cfg.OpenFgaServerSettings.DispatchThrottlingCheckResolverMaxThreshold))
	}

	// Shadow check/query settings
	if cfg.OpenFgaServerSettings.ShadowCheckResolverTimeout != 0 {
		opts = append(opts, server.WithShadowCheckResolverTimeout(cfg.OpenFgaServerSettings.ShadowCheckResolverTimeout))
	}
	if cfg.OpenFgaServerSettings.ShadowListObjectsQueryTimeout != 0 {
		opts = append(opts, server.WithShadowListObjectsQueryTimeout(cfg.OpenFgaServerSettings.ShadowListObjectsQueryTimeout))
	}
	if cfg.OpenFgaServerSettings.ShadowListObjectsQueryMaxDeltaItems != 0 {
		opts = append(opts, server.WithShadowListObjectsQueryMaxDeltaItems(cfg.OpenFgaServerSettings.ShadowListObjectsQueryMaxDeltaItems))
	}

	if cfg.OpenFgaServerSettings.RequestTimeout != 0 {
		opts = append(opts, server.WithRequestTimeout(cfg.OpenFgaServerSettings.RequestTimeout))
	}
	if cfg.OpenFgaServerSettings.MaxAuthorizationModelSizeInBytes != 0 {
		opts = append(opts, server.WithMaxAuthorizationModelSizeInBytes(cfg.OpenFgaServerSettings.MaxAuthorizationModelSizeInBytes))
	}
	if cfg.OpenFgaServerSettings.AuthorizationModelCacheSize != 0 {
		opts = append(opts, server.WithAuthorizationModelCacheSize(cfg.OpenFgaServerSettings.AuthorizationModelCacheSize))
	}
	if cfg.OpenFgaServerSettings.ChangelogHorizonOffset != 0 {
		opts = append(opts, server.WithChangelogHorizonOffset(cfg.OpenFgaServerSettings.ChangelogHorizonOffset))
	}

	return opts
}

func withListOptions(cfg setting.ZanzanaServerSettings) []server.OpenFGAServiceV1Option {
	opts := make([]server.OpenFGAServiceV1Option, 0)

	// ListObjects settings
	if cfg.OpenFgaServerSettings.MaxConcurrentReadsForListObjects != 0 {
		opts = append(opts, server.WithMaxConcurrentReadsForListObjects(cfg.OpenFgaServerSettings.MaxConcurrentReadsForListObjects))
	}
	if cfg.OpenFgaServerSettings.ListObjectsDispatchThrottlingEnabled {
		opts = append(opts, server.WithListObjectsDispatchThrottlingEnabled(cfg.OpenFgaServerSettings.ListObjectsDispatchThrottlingEnabled))
	}
	if cfg.OpenFgaServerSettings.ListObjectsDispatchThrottlingFrequency != 0 {
		opts = append(opts, server.WithListObjectsDispatchThrottlingFrequency(cfg.OpenFgaServerSettings.ListObjectsDispatchThrottlingFrequency))
	}
	if cfg.OpenFgaServerSettings.ListObjectsDispatchThrottlingThreshold != 0 {
		opts = append(opts, server.WithListObjectsDispatchThrottlingThreshold(cfg.OpenFgaServerSettings.ListObjectsDispatchThrottlingThreshold))
	}
	if cfg.OpenFgaServerSettings.ListObjectsDispatchThrottlingMaxThreshold != 0 {
		opts = append(opts, server.WithListObjectsDispatchThrottlingMaxThreshold(cfg.OpenFgaServerSettings.ListObjectsDispatchThrottlingMaxThreshold))
	}
	if cfg.OpenFgaServerSettings.ListObjectsDatabaseThrottleThreshold != 0 || cfg.OpenFgaServerSettings.ListObjectsDatabaseThrottleDuration != 0 {
		opts = append(opts, server.WithListObjectsDatabaseThrottle(cfg.OpenFgaServerSettings.ListObjectsDatabaseThrottleThreshold, cfg.OpenFgaServerSettings.ListObjectsDatabaseThrottleDuration))
	}

	// ListUsers settings
	if cfg.OpenFgaServerSettings.ListUsersDeadline != 0 {
		opts = append(opts, server.WithListUsersDeadline(cfg.OpenFgaServerSettings.ListUsersDeadline))
	}
	if cfg.OpenFgaServerSettings.ListUsersMaxResults != 0 {
		opts = append(opts, server.WithListUsersMaxResults(cfg.OpenFgaServerSettings.ListUsersMaxResults))
	}
	if cfg.OpenFgaServerSettings.MaxConcurrentReadsForListUsers != 0 {
		opts = append(opts, server.WithMaxConcurrentReadsForListUsers(cfg.OpenFgaServerSettings.MaxConcurrentReadsForListUsers))
	}
	if cfg.OpenFgaServerSettings.ListUsersDispatchThrottlingEnabled {
		opts = append(opts, server.WithListUsersDispatchThrottlingEnabled(cfg.OpenFgaServerSettings.ListUsersDispatchThrottlingEnabled))
	}
	if cfg.OpenFgaServerSettings.ListUsersDispatchThrottlingFrequency != 0 {
		opts = append(opts, server.WithListUsersDispatchThrottlingFrequency(cfg.OpenFgaServerSettings.ListUsersDispatchThrottlingFrequency))
	}
	if cfg.OpenFgaServerSettings.ListUsersDispatchThrottlingThreshold != 0 {
		opts = append(opts, server.WithListUsersDispatchThrottlingThreshold(cfg.OpenFgaServerSettings.ListUsersDispatchThrottlingThreshold))
	}
	if cfg.OpenFgaServerSettings.ListUsersDispatchThrottlingMaxThreshold != 0 {
		opts = append(opts, server.WithListUsersDispatchThrottlingMaxThreshold(cfg.OpenFgaServerSettings.ListUsersDispatchThrottlingMaxThreshold))
	}
	if cfg.OpenFgaServerSettings.ListUsersDatabaseThrottleThreshold != 0 || cfg.OpenFgaServerSettings.ListUsersDatabaseThrottleDuration != 0 {
		opts = append(opts, server.WithListUsersDatabaseThrottle(cfg.OpenFgaServerSettings.ListUsersDatabaseThrottleThreshold, cfg.OpenFgaServerSettings.ListUsersDatabaseThrottleDuration))
	}

	return opts
}

func NewOpenFGAHttpServer(cfg setting.ZanzanaServerSettings, grpcSrv grpcserver.Provider) (*http.Server, error) {
	dialOpts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	}

	addr := grpcSrv.GetAddress()
	// Wait until GRPC server is initialized
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	maxRetries := 100
	retries := 0
	for addr == "" && retries < maxRetries {
		<-ticker.C
		addr = grpcSrv.GetAddress()
		retries++
	}
	if addr == "" {
		return nil, fmt.Errorf("failed to create HTTP server: GRPC server unavailable")
	}

	conn, err := grpc.NewClient(addr, dialOpts...)
	if err != nil {
		return nil, fmt.Errorf("unable to dial GRPC: %w", err)
	}

	muxOpts := []runtime.ServeMuxOption{
		runtime.WithForwardResponseOption(httpmiddleware.HTTPResponseModifier),
		runtime.WithErrorHandler(func(c context.Context,
			sr *runtime.ServeMux, mm runtime.Marshaler, w http.ResponseWriter, r *http.Request, e error) {
			intCode := serverErrors.ConvertToEncodedErrorCode(status.Convert(e))
			httpmiddleware.CustomHTTPErrorHandler(c, w, r, serverErrors.NewEncodedError(intCode, e.Error()))
		}),
		runtime.WithStreamErrorHandler(func(ctx context.Context, e error) *status.Status {
			intCode := serverErrors.ConvertToEncodedErrorCode(status.Convert(e))
			encodedErr := serverErrors.NewEncodedError(intCode, e.Error())
			return status.Convert(encodedErr)
		}),
		runtime.WithHealthzEndpoint(healthv1pb.NewHealthClient(conn)),
		runtime.WithOutgoingHeaderMatcher(func(s string) (string, bool) { return s, true }),
	}
	mux := runtime.NewServeMux(muxOpts...)
	if err := openfgav1.RegisterOpenFGAServiceHandler(context.TODO(), mux, conn); err != nil {
		return nil, fmt.Errorf("failed to register gateway handler: %w", err)
	}

	return &http.Server{
		Addr: cfg.OpenFGAHttpAddr,
		Handler: cors.New(cors.Options{
			AllowedOrigins:   []string{"*"},
			AllowCredentials: true,
			AllowedHeaders:   []string{"*"},
			AllowedMethods: []string{http.MethodGet, http.MethodPost,
				http.MethodHead, http.MethodPatch, http.MethodDelete, http.MethodPut},
		}).Handler(mux),
		ReadHeaderTimeout: 30 * time.Second,
	}, nil
}
