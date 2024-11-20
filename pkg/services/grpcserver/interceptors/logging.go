package interceptors

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"google.golang.org/grpc"
)

func LoggingUnaryInterceptor(logger log.Logger, enabled bool) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (resp any, err error) {
		resp, err = handler(ctx, req)
		if enabled {
			ctxLogger := logger.FromContext(ctx)
			if err != nil {
				ctxLogger.Error("gRPC call", "method", info.FullMethod, "req", req, "err", err)
			} else {
				ctxLogger.Info("gRPC call", "method", info.FullMethod, "req", req, "resp", resp)
			}
		}
		return resp, err
	}
}
