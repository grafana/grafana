package interceptors

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

func LoggingUnaryInterceptor(cfg *setting.Cfg, logger log.Logger) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (resp any, err error) {
		resp, err = handler(ctx, req)
		if cfg.GRPCServerEnableLogging {
			md, _ := metadata.FromIncomingContext(ctx)

			// Redact grafana token from logs
			if _, ok := md["grafana-idtoken"]; ok {
				md["grafana-idtoken"] = []string{"REDACTED"}
			}

			ctxLogger := logger.FromContext(ctx)
			if err != nil {
				ctxLogger.Error("gRPC call", "method", info.FullMethod, "req", req, "err", err, "md", md)
			} else {
				ctxLogger.Info("gRPC call", "method", info.FullMethod, "req", req, "resp", resp, "md", md)
			}
		}
		return resp, err
	}
}
