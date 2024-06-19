package grpc

import (
	"context"
	"fmt"
	"strconv"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
)

type Authenticator struct{}

const (
	keyIDToken = "grafana-idtoken"
	keyLogin   = "grafana-login"
	keyUserID  = "grafana-userid"
	keyUserUID = "grafana-useruid"
	keyOrgID   = "grafana-orgid"
)

func (f *Authenticator) Authenticate(ctx context.Context) (context.Context, error) {
	requester, _ := identity.GetRequester(ctx)
	if requester != nil {
		return ctx, nil // identity is already in the context
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, fmt.Errorf("no metadata found")
	}

	token := md.Get(keyIDToken)[0]
	if token != "" {
		token = "TODO"
		// fmt.Printf("TODO, create the requester from the token!")
		//
		// jwtToken, err := jwt.ParseSigned(idToken)
		// if err != nil {
		// 	return nil, fmt.Errorf("invalid id token: %w", err)
		// }
		// claims := jwt.Claims{}
		// err = jwtToken.UnsafeClaimsWithoutVerification(&claims)
		// if err != nil {
		// 	return nil, fmt.Errorf("invalid id token: %w", err)
		// }
		// fmt.Printf("JWT CLAIMS: %+v\n", claims)
	}

	login := md.Get(keyLogin)[0]
	if login == "" {
		return nil, fmt.Errorf("no login found in grpc context")
	}
	userID, err := strconv.ParseInt(md.Get(keyUserID)[0], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid grpc user id: %w", err)
	}
	orgID, err := strconv.ParseInt(md.Get(keyOrgID)[0], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid grpc org id: %w", err)
	}

	return identity.WithRequester(ctx, &identity.StaticRequester{
		Login:   login,
		UserID:  userID,
		OrgID:   orgID,
		UserUID: md.Get(keyUserUID)[0],
	}), nil
}

var _ interceptors.Authenticator = (*Authenticator)(nil)

func UnaryClientInterceptor(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
	ctx, err := WrapContext(ctx)
	if err != nil {
		return err
	}
	return invoker(ctx, method, req, reply, cc, opts...)
}

var _ grpc.UnaryClientInterceptor = UnaryClientInterceptor

func StreamClientInterceptor(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	ctx, err := WrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return streamer(ctx, desc, cc, method, opts...)
}

var _ grpc.StreamClientInterceptor = StreamClientInterceptor

func WrapContext(ctx context.Context) (context.Context, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return ctx, err
	}

	// set grpc metadata into the context to pass to the grpc server
	return metadata.NewOutgoingContext(ctx, metadata.Pairs(
		keyIDToken, user.GetIDToken(),
		keyLogin, user.GetLogin(),
		keyOrgID, strconv.FormatInt(user.GetOrgID(), 10),
		keyUserID, user.GetID().ID(),
		keyUserUID, user.GetUID().ID(),
	)), nil
}
