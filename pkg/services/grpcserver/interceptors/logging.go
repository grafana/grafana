package interceptors

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"google.golang.org/grpc"
)

func LoggingUnaryInterceptor(logger log.Logger) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (resp any, err error) {
		logger = logger.FromContext(ctx)
		logger.Info("gRPC call received", "method", info.FullMethod, "req", req)
		resp, err = handler(ctx, req)
		return resp, err
	}
}
