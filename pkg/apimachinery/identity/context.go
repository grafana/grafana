package identity

import (
	"context"
	"fmt"
	"reflect"

	"github.com/grafana/authlib/types"
)

type ctxUserKey struct{}

// WithRequester attaches the requester to the context.
func WithRequester(ctx context.Context, usr Requester) context.Context {
	ctx = types.WithAuthInfo(ctx, usr) // also set the upstream auth info claims
	return context.WithValue(ctx, ctxUserKey{}, usr)
}

// Get the Requester from context
func GetRequester(ctx context.Context) (Requester, error) {
	// Set by appcontext.WithUser
	u, ok := ctx.Value(ctxUserKey{}).(Requester)
	if ok && !checkNilRequester(u) {
		return u, nil
	}
	return nil, fmt.Errorf("a Requester was not found in the context")
}

func checkNilRequester(r Requester) bool {
	return r == nil || (reflect.ValueOf(r).Kind() == reflect.Ptr && reflect.ValueOf(r).IsNil())
}

// WithGrafanaIdentity sets creates an identity representing grafana in provided org and store it in context.
// This is useful for background tasks that has to communicate with unfied storage. It also returns a Requester with
// static permissions so it can be used in legacy code paths.
func WithGrafanaIdentity(ctx context.Context, orgID int64) (context.Context, Requester) {
	r := &StaticRequester{
		Type:           types.TypeAccessPolicy,
		UserUID:        "grafana",
		OrgRole:        RoleAdmin,
		IsGrafanaAdmin: true,
		AuthID:         "grafana",
		OrgID:          orgID,
		Permissions: map[int64]map[string][]string{
			orgID: grafanaIdentityPermissions,
		},
	}

	return WithRequester(ctx, r), r
}

func getWildcardPermissions(actions ...string) map[string][]string {
	permissions := make(map[string][]string, len(actions))
	for _, a := range actions {
		permissions[a] = []string{"*"}
	}
	return permissions
}

// grafanaIdentityPermissions is a list of wildcard permissions for provided actions.
// We should add every action required "internally" here.
var grafanaIdentityPermissions = getWildcardPermissions(
	"folders:read",
	"folders:write",
	"folders:create",
	"dashboards:read",
	"dashboards:write",
	"dashboards:create",
	"datasources:read",
)

func IsGrafanaIdentity(ctx context.Context) bool {
	ident, err := GetRequester(ctx)
	if err != nil {
		return false
	}
	return ident.GetUID() == types.NewTypeID(types.TypeAccessPolicy, "grafana")
}
