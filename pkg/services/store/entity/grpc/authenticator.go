package grpc

import (
	"context"
	"fmt"
	"strconv"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/services/user"
)

type Authenticator struct{}

func (f *Authenticator) Authenticate(ctx context.Context) (context.Context, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, fmt.Errorf("no metadata found")
	}

	// TODO: use id token instead of these fields
	login := md.Get("grafana-login")[0]
	if login == "" {
		return nil, fmt.Errorf("no login found in context")
	}
	userID, err := strconv.ParseInt(md.Get("grafana-userid")[0], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}
	orgID, err := strconv.ParseInt(md.Get("grafana-orgid")[0], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid org id: %w", err)
	}

	// TODO: validate id token
	/*
		idToken := md.Get("grafana-idtoken")[0]
		if idToken == "" {
			return nil, fmt.Errorf("no id token found in context")
		}
		jwtToken, err := jwt.ParseSigned(idToken)
		if err != nil {
			return nil, fmt.Errorf("invalid id token: %w", err)
		}
		claims := jwt.Claims{}
		err = jwtToken.UnsafeClaimsWithoutVerification(&claims)
		if err != nil {
			return nil, fmt.Errorf("invalid id token: %w", err)
		}
		// fmt.Printf("JWT CLAIMS: %+v\n", claims)
	*/

	return appcontext.WithUser(ctx, &user.SignedInUser{
		Login:  login,
		UserID: userID,
		OrgID:  orgID,
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
		"grafana-idtoken", user.GetIDToken(),
		"grafana-userid", user.GetID().ID(),
		"grafana-useruid", user.GetUID().ID(),
		"grafana-orgid", strconv.FormatInt(user.GetOrgID(), 10),
		"grafana-login", user.GetLogin(),
	)), nil
}
