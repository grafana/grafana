package interceptors

import (
	"context"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"google.golang.org/grpc"
)

// InnermostServiceIdentityUnaryServerInterceptor extracts the innermost service identity from the auth info
// into the context. If the auth info key is absent, it does nothing.
// Must be placed in the interceptor chain AFTER authentication so that auth info is available.
func InnermostServiceIdentityUnaryServerInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if authInfo, ok := types.AuthInfoFrom(ctx); ok {
			if innermostSvcIdentity := authInfo.GetExtra()["innermostServiceIdentity"]; len(innermostSvcIdentity) > 0 {
				ctx = identity.WithInnermostServiceIdentity(ctx, innermostSvcIdentity[0])
			}
		}
		return handler(ctx, req)
	}
}

// InnermostServiceIdentityStreamServerInterceptor is the streaming equivalent of InnermostServiceIdentityUnaryServerInterceptor.
func InnermostServiceIdentityStreamServerInterceptor() grpc.StreamServerInterceptor {
	return func(srv any, ss grpc.ServerStream, _ *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		ctx := ss.Context()
		if authInfo, ok := types.AuthInfoFrom(ctx); ok {
			if innermostSvcIdentity := authInfo.GetExtra()["innermostServiceIdentity"]; len(innermostSvcIdentity) > 0 {
				ss = &innermostServiceIdentityServerStream{
					ServerStream: ss,
					ctx:          identity.WithInnermostServiceIdentity(ctx, innermostSvcIdentity[0]),
				}
			}
		}
		return handler(srv, ss)
	}
}

type innermostServiceIdentityServerStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (w *innermostServiceIdentityServerStream) Context() context.Context { return w.ctx }
