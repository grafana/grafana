package interceptors

import (
	"context"

	"github.com/grafana/grafana/pkg/services/mtctx"
	"google.golang.org/grpc"
)

func StackIdUnaryInterceptor(mt mtctx.Service) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (resp interface{}, err error) {
		return handler(mt.AttachTenantInfo(ctx), req)
	}
}

func StackIdStreamInterceptor(mt mtctx.Service) grpc.StreamServerInterceptor {
	return func(srv interface{}, stream grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		wrapper := &stackIdServerStream{
			ServerStream: stream,
			ctx:          mt.AttachTenantInfo(stream.Context()),
		}
		return handler(srv, wrapper)
	}
}

type stackIdServerStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s *stackIdServerStream) Context() context.Context {
	return s.ctx
}
