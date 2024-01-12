package interceptors

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/infra/tracing"
)

const tracingPrefix = "gRPC Server "

func TracingUnaryInterceptor(tracer tracing.Tracer) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (resp any, err error) {
		if md, ok := metadata.FromIncomingContext(ctx); ok {
			ctx = otel.GetTextMapPropagator().Extract(ctx, propagation.HeaderCarrier(md))
		}

		ctx, span := tracer.Start(ctx, tracingPrefix+info.FullMethod)
		defer span.End()
		resp, err = handler(ctx, req)
		return resp, err
	}
}

func TracingStreamInterceptor(tracer tracing.Tracer) grpc.StreamServerInterceptor {
	return func(srv any, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		ctx := stream.Context()
		if md, ok := metadata.FromIncomingContext(ctx); ok {
			ctx = otel.GetTextMapPropagator().Extract(ctx, propagation.HeaderCarrier(md))
		}
		ctx, span := tracer.Start(ctx, tracingPrefix+info.FullMethod)
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
