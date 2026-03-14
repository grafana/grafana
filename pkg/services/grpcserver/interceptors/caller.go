package interceptors

import (
	"context"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/apiserver/identity"
)

// CallerUnaryServerInterceptor extracts the upstream caller identity from inbound gRPC metadata
// into the context. If the metadata key is absent, it falls back to the authenticated
// caller's service identity from the auth info.
//
// Must be placed in the interceptor chain AFTER authentication so that auth info is available.
func CallerUnaryServerInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		var inbound string
		if md, ok := metadata.FromIncomingContext(ctx); ok {
			if vals := md.Get(identity.MetadataKeyUpstreamCaller); len(vals) > 0 {
				inbound = vals[0]
			}
		}
		if caller := identity.ResolveUpstreamCaller(ctx, inbound); caller != "" {
			ctx = identity.WithUpstreamCaller(ctx, caller)
		}
		return handler(ctx, req)
	}
}

// CallerStreamServerInterceptor is the streaming equivalent of CallerUnaryServerInterceptor.
func CallerStreamServerInterceptor() grpc.StreamServerInterceptor {
	return func(srv any, ss grpc.ServerStream, _ *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		ctx := ss.Context()
		var inbound string
		if md, ok := metadata.FromIncomingContext(ctx); ok {
			if vals := md.Get(identity.MetadataKeyUpstreamCaller); len(vals) > 0 {
				inbound = vals[0]
			}
		}
		if caller := identity.ResolveUpstreamCaller(ctx, inbound); caller != "" {
			ss = &callerServerStream{ServerStream: ss, ctx: identity.WithUpstreamCaller(ctx, caller)}
		}
		return handler(srv, ss)
	}
}

type callerServerStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (w *callerServerStream) Context() context.Context { return w.ctx }

// CallerUnaryClientInterceptor propagates the upstream caller identity from the context
// to outgoing gRPC metadata. It preserves existing metadata if already set.
func CallerUnaryClientInterceptor() grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply any, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		ctx = appendUpstreamCallerToOutgoingMD(ctx)
		return invoker(ctx, method, req, reply, cc, opts...)
	}
}

// CallerStreamClientInterceptor is the streaming equivalent of CallerUnaryClientInterceptor.
func CallerStreamClientInterceptor() grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		ctx = appendUpstreamCallerToOutgoingMD(ctx)
		return streamer(ctx, desc, cc, method, opts...)
	}
}

func appendUpstreamCallerToOutgoingMD(ctx context.Context) context.Context {
	caller := identity.UpstreamCallerFromContext(ctx)
	if caller == "" {
		return ctx
	}
	// Don't override if already set in outgoing metadata, we need to preserver the original service that set it.
	if md, ok := metadata.FromOutgoingContext(ctx); ok {
		if vals := md.Get(identity.MetadataKeyUpstreamCaller); len(vals) > 0 {
			return ctx
		}
	}
	return metadata.AppendToOutgoingContext(ctx, identity.MetadataKeyUpstreamCaller, caller)
}
