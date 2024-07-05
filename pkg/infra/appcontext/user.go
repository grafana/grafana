package appcontext

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
	"github.com/grafana/grafana/pkg/services/user"
)

type ctxUserKey struct{}

// WithUser adds the supplied SignedInUser to the context.
func WithUser(ctx context.Context, usr *user.SignedInUser) context.Context {
	ctx = context.WithValue(ctx, ctxUserKey{}, usr)
	// make sure it is also in the simplified version
	if usr == nil || usr.IsNil() {
		return identity.WithRequester(ctx, nil)
	}
	return identity.WithRequester(ctx, usr)
}

// User extracts the SignedInUser from the supplied context.
// Supports context set by appcontext.WithUser, gRPC server context, and HTTP ReqContext.
// Deprecated: use identity.GetRequester(ctx) when possible
func User(ctx context.Context) (*user.SignedInUser, error) {
	// Set by appcontext.WithUser
	u, ok := ctx.Value(ctxUserKey{}).(*user.SignedInUser)
	if ok && u != nil {
		return u, nil
	}

	// Set by incoming gRPC server request
	grpcCtx := grpccontext.FromContext(ctx)
	if grpcCtx != nil && grpcCtx.SignedInUser != nil {
		return grpcCtx.SignedInUser, nil
	}

	// If the identity was set via requester, but not appcontext, we can map values
	// NOTE: this path
	requester, _ := identity.GetRequester(ctx)
	if requester != nil {
		id := requester.GetID()
		userId, _ := id.UserID()
		orgId := requester.GetOrgID()
		return &user.SignedInUser{
			NamespacedID:    id,
			UserID:          userId,
			UserUID:         requester.GetUID().ID(),
			OrgID:           orgId,
			OrgName:         requester.GetOrgName(),
			OrgRole:         requester.GetOrgRole(),
			Login:           requester.GetLogin(),
			Email:           requester.GetEmail(),
			IsGrafanaAdmin:  requester.GetIsGrafanaAdmin(),
			Teams:           requester.GetTeams(),
			AuthID:          requester.GetAuthID(),
			AuthenticatedBy: requester.GetAuthenticatedBy(),
			IDToken:         requester.GetIDToken(),
			Permissions: map[int64]map[string][]string{
				0:     requester.GetGlobalPermissions(),
				orgId: requester.GetPermissions(),
			},
		}, nil
	}

	return nil, fmt.Errorf("a SignedInUser was not found in the context")
}

// MustUser extracts the SignedInUser from the supplied context, and panics if a user is not found.
// Supports context set by appcontext.WithUser, gRPC server context, and HTTP ReqContext.
func MustUser(ctx context.Context) *user.SignedInUser {
	usr, err := User(ctx)
	if err != nil {
		panic(err)
	}
	return usr
}
