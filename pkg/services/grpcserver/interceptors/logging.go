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
		resp, err = handler(ctx, req)
		logger.Info("gRPC call received", "method", info.FullMethod, "req", req, "resp", resp, "err", err)
		return resp, err
	}
}
