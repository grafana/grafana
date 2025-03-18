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
	"go.uber.org/zap/zapcore"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	healthv1pb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"

	zlogger "github.com/grafana/grafana/pkg/services/authz/zanzana/logger"
)

func NewOpenFGA(cfg *setting.ZanzanaSettings, store storage.OpenFGADatastore, logger log.Logger) (*server.Server, error) {
	opts := []server.OpenFGAServiceV1Option{
		server.WithDatastore(store),
		server.WithLogger(zlogger.New(logger)),
		server.WithCheckQueryCacheEnabled(cfg.CheckQueryCache),
		server.WithCheckQueryCacheTTL(cfg.CheckQueryCacheTTL),
		server.WithListObjectsMaxResults(cfg.ListObjectsMaxResults),
		server.WithListObjectsDeadline(cfg.ListObjectsDeadline),
	}

	// FIXME(kalleep): Interceptors
	// We probably need to at least need to add store id interceptor also
	// would be nice to inject our own requestid?
	srv, err := server.NewServerWithOpts(opts...)
	if err != nil {
		return nil, err
	}

	return srv, nil
}

// StartOpenFGAHttpSever starts HTTP server which allows to use fga cli.
func StartOpenFGAHttpSever(cfg *setting.Cfg, srv grpcserver.Provider, logger log.Logger) error {
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
		return fmt.Errorf("failed to start HTTP server: GRPC server unavailable")
	}

	conn, err := grpc.NewClient(addr, dialOpts...)
	if err != nil {
		return fmt.Errorf("unable to dial GRPC: %w", err)
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
		return fmt.Errorf("failed to register gateway handler: %w", err)
	}

	httpServer := &http.Server{
		Addr: cfg.Zanzana.HttpAddr,
		Handler: cors.New(cors.Options{
			AllowedOrigins:   []string{"*"},
			AllowCredentials: true,
			AllowedHeaders:   []string{"*"},
			AllowedMethods: []string{http.MethodGet, http.MethodPost,
				http.MethodHead, http.MethodPatch, http.MethodDelete, http.MethodPut},
		}).Handler(mux),
		ReadHeaderTimeout: 30 * time.Second,
	}
	go func() {
		err = httpServer.ListenAndServe()
		if err != nil {
			logger.Error("failed to start http server", zapcore.Field{Key: "err", Type: zapcore.ErrorType, Interface: err})
		}
	}()
	logger.Info(fmt.Sprintf("OpenFGA HTTP server listening on '%s'...", httpServer.Addr))
	return nil
}
