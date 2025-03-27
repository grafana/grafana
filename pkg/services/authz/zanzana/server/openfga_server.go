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

func NewOpenFGAServer(cfg setting.ZanzanaServerSettings, store storage.OpenFGADatastore, logger log.Logger) (*server.Server, error) {
	opts := []server.OpenFGAServiceV1Option{
		server.WithDatastore(store),
		server.WithLogger(zlogger.New(logger)),
		server.WithCheckQueryCacheEnabled(cfg.CheckQueryCache),
		server.WithCheckQueryCacheTTL(cfg.CheckQueryCacheTTL),
		server.WithListObjectsMaxResults(cfg.ListObjectsMaxResults),
		server.WithListObjectsDeadline(cfg.ListObjectsDeadline),
	}

	srv, err := server.NewServerWithOpts(opts...)
	if err != nil {
		return nil, err
	}

	return srv, nil
}

func NewOpenFGAHttpServer(cfg setting.ZanzanaServerSettings, srv grpcserver.Provider) (*http.Server, error) {
	dialOpts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	}

	addr := srv.GetAddress()
	// Wait until GRPC server is initialized
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	maxRetries := 100
	retries := 0
	for addr == "" && retries < maxRetries {
		<-ticker.C
		addr = srv.GetAddress()
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
