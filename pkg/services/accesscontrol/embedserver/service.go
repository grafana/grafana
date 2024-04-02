package embedserver

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"time"

	grpc_ctxtags "github.com/grpc-ecosystem/go-grpc-middleware/tags"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/gateway"
	"github.com/openfga/openfga/pkg/logger"
	httpmiddleware "github.com/openfga/openfga/pkg/middleware/http"
	"github.com/openfga/openfga/pkg/middleware/logging"
	"github.com/openfga/openfga/pkg/middleware/requestid"
	"github.com/openfga/openfga/pkg/middleware/storeid"
	"github.com/openfga/openfga/pkg/middleware/validator"
	"github.com/openfga/openfga/pkg/server"
	serverErrors "github.com/openfga/openfga/pkg/server/errors"
	"github.com/openfga/openfga/pkg/storage/memory"
	"github.com/rs/cors"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	healthv1pb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	cfg      *setting.Cfg
	features featuremgmt.FeatureToggles
	log      log.Logger

	srv *server.Server
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*Service, error) {
	s := &Service{
		cfg:      cfg,
		features: features,
		log:      log.New("accesscontrol.service"),
	}

	// FIXME: Replace with zap compatible logger
	zapLogger := logger.MustNewLogger("text", "debug", "ISO8601")
	srv, err := s.newServer(zapLogger)
	if err != nil {
		return nil, err
	}

	ready, err := srv.IsReady(context.Background())
	if err != nil {
		s.log.Error("Access Control Server failed to start", "error", err)
	}

	s.log.Info("Access Control Server started", "ready", ready)

	s.srv = srv

	serverOpts := []grpc.ServerOption{
		grpc.MaxRecvMsgSize(512 * 1_204), // 512 KB
		grpc.ChainUnaryInterceptor(
			[]grpc.UnaryServerInterceptor{
				grpc_ctxtags.UnaryServerInterceptor(),    // needed for logging
				requestid.NewUnaryInterceptor(),          // add request_id to ctxtags
				storeid.NewUnaryInterceptor(),            // if available, add store_id to ctxtags
				logging.NewLoggingInterceptor(zapLogger), // needed to log invalid requests
				validator.UnaryServerInterceptor(),
			}...,
		),
		grpc.ChainStreamInterceptor(
			[]grpc.StreamServerInterceptor{
				requestid.NewStreamingInterceptor(),
				validator.StreamServerInterceptor(),
				grpc_ctxtags.StreamServerInterceptor(),
			}...,
		),
	}

	grpcServer := grpc.NewServer(serverOpts...)
	openfgav1.RegisterOpenFGAServiceServer(grpcServer, srv)
	reflection.Register(grpcServer)

	// FIXME: This is a dev env to start the server on a fixed port.
	lis, err := net.Listen("tcp", "127.0.0.1:8082")
	if err != nil {
		return nil, fmt.Errorf("failed to listen: %w", err)
	}

	addr := lis.Addr().String()
	go func() {
		if err := grpcServer.Serve(lis); err != nil {
			if !errors.Is(err, grpc.ErrServerStopped) {
				s.log.Error("failed to start grpc server", "err", err)
			}

			s.log.Info("grpc server shut down..")
		}
	}()

	s.log.Info(fmt.Sprintf("grpc server listening on '%s'...", addr))

	if s.cfg.Env == setting.Dev {
		go func() {
			dialOpts := []grpc.DialOption{
				grpc.WithBlock(),
				grpc.WithTransportCredentials(insecure.NewCredentials()),
			}

			timeoutCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()

			conn, err := grpc.DialContext(timeoutCtx, addr, dialOpts...)
			if err != nil {
				s.log.Error("Unable to Dial GRPC", "err", err)
			}

			muxOpts := []runtime.ServeMuxOption{
				runtime.WithForwardResponseOption(httpmiddleware.HTTPResponseModifier),
				runtime.WithErrorHandler(func(c context.Context, sr *runtime.ServeMux, mm runtime.Marshaler, w http.ResponseWriter, r *http.Request, e error) {
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
				s.log.Error("failed to register gateway handler", "err", err)
				return
			}

			httpServer := &http.Server{
				Addr: "127.0.0.1:8080",
				Handler: cors.New(cors.Options{
					AllowedOrigins:   []string{"*"},
					AllowCredentials: true,
					AllowedHeaders:   []string{"*"},
					AllowedMethods: []string{http.MethodGet, http.MethodPost,
						http.MethodHead, http.MethodPatch, http.MethodDelete, http.MethodPut},
				}).Handler(mux),
			}
			go func() {
				err = httpServer.ListenAndServe()
				if err != nil {
					s.log.Error("failed to start http server", "err", err)
				}
			}()
			s.log.Info(fmt.Sprintf("HTTP server listening on '%s'...", httpServer.Addr))
		}()
	}

	return s, nil
}

func (s *Service) newServer(logger *logger.ZapLogger) (*server.Server, error) {
	return server.NewServerWithOpts(
		server.WithDatastore(memory.New()),
		server.WithLogger(logger),
		server.WithTransport(gateway.NewRPCTransport(logger)))
}
