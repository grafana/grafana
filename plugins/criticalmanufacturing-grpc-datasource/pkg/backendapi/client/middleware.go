package client

import (
	"context"
	"path"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"google.golang.org/grpc"
)

// GRPCDebugLogger returns a new unary client interceptor that optionally logs the execution of external gRPC calls.
func GRPCDebugLogger() grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		startTime := time.Now()
		service := path.Dir(method)[1:]
		log.DefaultLogger.Debug("grpc call started", "service", service, "method", method)
		err := invoker(ctx, method, req, reply, cc, opts...)
		log.DefaultLogger.Debug("grpc call finished", "service", service, "method", method, "duration", time.Now().Sub(startTime).String(), "err", err)

		return err
	}
}
