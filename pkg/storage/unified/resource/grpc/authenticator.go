package grpc

import (
	"context"
	"fmt"
	"strconv"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/authlib/authn"
	authClaims "github.com/grafana/authlib/claims"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

const (
	mdToken   = "grafana-idtoken"
	mdLogin   = "grafana-login"
	mdUserID  = "grafana-user-id"
	mdUserUID = "grafana-user-uid"
	mdOrgID   = "grafana-org-id"
	mdOrgRole = "grafana-org-role"
)

// This is in a package we can no import
// var _ interceptors.Authenticator = (*Authenticator)(nil)

type Authenticator struct {
	IDTokenVerifier authn.Verifier[authn.IDTokenClaims]
}

func (f *Authenticator) Authenticate(ctx context.Context) (context.Context, error) {
	r, err := identity.GetRequester(ctx)
	if err == nil && r != nil {
		return ctx, nil // noop, requester exists
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return nil, fmt.Errorf("no metadata found")
	}
	user, err := f.decodeMetadata(ctx, md)
	if err != nil {
		return nil, err
	}
	return identity.WithRequester(ctx, user), nil
}

func (f *Authenticator) decodeMetadata(ctx context.Context, meta metadata.MD) (identity.Requester, error) {
	// Avoid NPE/panic with getting keys
	getter := func(key string) string {
		v := meta.Get(key)
		if len(v) > 0 {
			return v[0]
		}
		return ""
	}

	// First try the token
	token := getter(mdToken)
	if token != "" && f.IDTokenVerifier != nil {
		claims, err := f.IDTokenVerifier.Verify(ctx, token)
		if err != nil {
			return nil, err
		}
		fmt.Printf("TODO, convert CLAIMS to an identity %+v\n", claims)
	}

	user := &identity.StaticRequester{}
	user.Login = getter(mdLogin)
	if user.Login == "" {
		return nil, fmt.Errorf("no login found in grpc metadata")
	}

	// The namespaced versions have a "-" in the key
	// TODO, remove after this has been deployed to unified storage
	if getter(mdUserID) == "" {
		var err error
		user.Type = authClaims.TypeUser
		user.UserID, err = strconv.ParseInt(getter("grafana-userid"), 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid user id: %w", err)
		}
		user.OrgID, err = strconv.ParseInt(getter("grafana-orgid"), 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid org id: %w", err)
		}
		return user, nil
	}

	typ, id, err := authClaims.ParseTypeID(getter(mdUserID))
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}
	user.Type = typ
	user.UserID, err = strconv.ParseInt(id, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}

	_, id, err = authClaims.ParseTypeID(getter(mdUserUID))
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}
	user.UserUID = id

	user.OrgID, err = strconv.ParseInt(getter(mdOrgID), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid org id: %w", err)
	}
	user.OrgRole = identity.RoleType(getter(mdOrgRole))
	return user, nil
}

func UnaryClientInterceptor(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
	ctx, err := wrapContext(ctx)
	if err != nil {
		return err
	}
	return invoker(ctx, method, req, reply, cc, opts...)
}

var _ grpc.UnaryClientInterceptor = UnaryClientInterceptor

func StreamClientInterceptor(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
	ctx, err := wrapContext(ctx)
	if err != nil {
		return nil, err
	}
	return streamer(ctx, desc, cc, method, opts...)
}

var _ grpc.StreamClientInterceptor = StreamClientInterceptor

func wrapContext(ctx context.Context) (context.Context, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return ctx, err
	}

	// set grpc metadata into the context to pass to the grpc server
	return metadata.NewOutgoingContext(ctx, encodeIdentityInMetadata(user)), nil
}

func encodeIdentityInMetadata(user identity.Requester) metadata.MD {
	id, _ := user.GetInternalID()

	return metadata.Pairs(
		// This should be everything needed to recreate the user
		mdToken, user.GetIDToken(),

		// Or we can create it directly
		mdUserID, user.GetID(),
		mdUserUID, user.GetUID(),
		mdOrgID, strconv.FormatInt(user.GetOrgID(), 10),
		mdOrgRole, string(user.GetOrgRole()),
		mdLogin, user.GetLogin(),

		// TODO, Remove after this is deployed to unified storage
		"grafana-userid", strconv.FormatInt(id, 10),
		"grafana-useruid", user.GetRawIdentifier(),
	)
}
