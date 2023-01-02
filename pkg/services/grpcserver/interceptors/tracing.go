package interceptors

import (
	"context"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/infra/tracing"
)

const tracingPrefix = "gRPC Server "

func TracingUnaryInterceptor(tracer tracing.Tracer) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (resp interface{}, err error) {
		ctx, span := tracer.Start(ctx, tracingPrefix+info.FullMethod)
		defer span.End()
		resp, err = handler(ctx, req)
		return resp, err
	}
}

func TracingStreamInterceptor(tracer tracing.Tracer) grpc.StreamServerInterceptor {
	return func(srv interface{}, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		ctx, span := tracer.Start(stream.Context(), tracingPrefix+info.FullMethod)
		defer span.End()
		tracingStream := &tracingServerStream{
			ServerStream: stream,
			ctx:          ctx,
		}
		return handler(srv, tracingStream)
	}
}

type tracingServerStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s *tracingServerStream) Context() context.Context {
	return s.ctx
}
