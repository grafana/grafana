package interceptors

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
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
			fmt.Println("metadata.FromIncomingContext(ctx)", md)
			ctx = otel.GetTextMapPropagator().Extract(ctx, propagation.HeaderCarrier(md))

			// extract traceparent from metadata into context
			mapCarrier := propagation.MapCarrier{}
			mapCarrier.Set("traceparent", md["traceparent"][0])
			ctx = propagation.TraceContext{}.Extract(ctx, mapCarrier)
		}

		fmt.Println("traceID received", tracing.TraceIDFromContext(ctx, false))
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
