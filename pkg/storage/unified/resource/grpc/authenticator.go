package grpc

import (
	"context"
	"log/slog"
	"strconv"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace"

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

var logger = slog.Default().With("logger", "legacy.grpc.Authenticator")

// This is in a package we can no import
// var _ interceptors.Authenticator = (*Authenticator)(nil)

type Authenticator struct {
	Tracer trace.Tracer
}

func (f *Authenticator) Authenticate(ctx context.Context) (context.Context, error) {
	ctx, span := f.Tracer.Start(ctx, "legacy.grpc.Authenticator.Authenticate")
	defer span.End()

	r, err := identity.GetRequester(ctx)
	if err == nil && r != nil {
		return ctx, nil // noop, requester exists
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		err := status.Error(codes.Unauthenticated, "no metadata found in grpc context")
		span.RecordError(err)
		return nil, err
	}
	user, err := f.decodeMetadata(md)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}
	return identity.WithRequester(ctx, user), nil
}

func (f *Authenticator) decodeMetadata(meta metadata.MD) (identity.Requester, error) {
	// Avoid NPE/panic with getting keys
	getter := func(key string) string {
		v := meta.Get(key)
		if len(v) > 0 {
			return v[0]
		}
		return ""
	}

	user := &identity.StaticRequester{}
	user.Login = getter(mdLogin)
	if user.Login == "" {
		return nil, status.Error(codes.Unauthenticated, "no login found in grpc metadata")
	}

	// The namespaced versions have a "-" in the key
	// TODO, remove after this has been deployed to unified storage
	if getter(mdUserID) == "" {
		var err error
		user.Type = types.TypeUser
		user.UserID, err = strconv.ParseInt(getter("grafana-userid"), 10, 64)
		if err != nil {
			return nil, status.Error(codes.Unauthenticated, "invalid user id")
		}
		user.OrgID, err = strconv.ParseInt(getter("grafana-orgid"), 10, 64)
		if err != nil {
			return nil, status.Error(codes.Unauthenticated, "invalid org id")
		}
		return user, nil
	}

	typ, id, err := types.ParseTypeID(getter(mdUserID))
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid user id")
	}
	user.Type = typ
	user.UserID, err = strconv.ParseInt(id, 10, 64)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid user id")
	}

	_, uid, err := types.ParseTypeID(getter(mdUserUID))
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid user uid")
	}
	user.UserUID = uid

	user.OrgID, err = strconv.ParseInt(getter(mdOrgID), 10, 64)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid org id")
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
	ctx = metadata.AppendToOutgoingContext(ctx, encodeIdentityInMetadataPairs(user)...)
	return ctx, nil
}

func encodeIdentityInMetadataPairs(user identity.Requester) []string {
	id, _ := user.GetInternalID()

	logger.Debug("encodeIdentityInMetadataPairs", "user.id", user.GetID(), "user.Login", user.GetLogin(), "user.Name", user.GetName())

	return []string{
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
	}
}
