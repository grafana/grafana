package appcontext

import (
	"context"
	"fmt"

	k8suser "k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
	"github.com/grafana/grafana/pkg/services/user"
)

type ctxUserKey struct{}

// WithUser adds the supplied SignedInUser to the context.
func WithUser(ctx context.Context, usr *user.SignedInUser) context.Context {
	ctx = context.WithValue(ctx, ctxUserKey{}, usr)
	return identity.WithRequester(ctx, usr)
}

// User extracts the SignedInUser from the supplied context.
// Supports context set by appcontext.WithUser, gRPC server context, and HTTP ReqContext.
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

	// Set by incoming HTTP request
	c, ok := ctxkey.Get(ctx).(*contextmodel.ReqContext)
	if ok && c.SignedInUser != nil {
		return c.SignedInUser, nil
	}

	// Find the kubernetes user info
	k8sUserInfo, ok := request.UserFrom(ctx)
	if ok {
		for _, group := range k8sUserInfo.GetGroups() {
			switch group {
			case k8suser.APIServerUser:
				fallthrough
			case k8suser.SystemPrivilegedGroup:
				orgId := int64(1)
				return &user.SignedInUser{
					UserID:         1,
					OrgID:          orgId,
					Name:           k8sUserInfo.GetName(),
					Login:          k8sUserInfo.GetName(),
					OrgRole:        identity.RoleAdmin,
					IsGrafanaAdmin: true,
					Permissions: map[int64]map[string][]string{
						orgId: {
							"*": {"*"}, // all resources, all scopes

							// Dashboards do not support wildcard action
							dashboards.ActionDashboardsRead:   {"*"},
							dashboards.ActionDashboardsCreate: {"*"},
							dashboards.ActionDashboardsWrite:  {"*"},
							dashboards.ActionDashboardsDelete: {"*"},
							dashboards.ActionFoldersCreate:    {"*"},
							dashboards.ActionFoldersRead:      {dashboards.ScopeFoldersAll}, // access to read all folders
						},
					},
				}, nil
			}
		}
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
