package identity

import (
	"context"
	"fmt"
	"reflect"

	"github.com/grafana/authlib/authn"
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

const (
	serviceName                = "service"
	serviceNameForProvisioning = "provisioning"
)

func newInternalIdentity(name string, namespace string, orgID int64) Requester {
	return &StaticRequester{
		Type:           types.TypeAccessPolicy,
		Name:           name,
		UserUID:        name,
		AuthID:         name,
		Login:          name,
		OrgRole:        RoleAdmin,
		Namespace:      namespace,
		IsGrafanaAdmin: true,
		OrgID:          orgID,
		Permissions: map[int64]map[string][]string{
			orgID: serviceIdentityPermissions,
		},
		AccessTokenClaims: ServiceIdentityClaims,
	}
}

// WithServiceIdentity sets an identity representing the service itself in provided org and store it in context.
// This is useful for background tasks that has to communicate with unfied storage. It also returns a Requester with
// static permissions so it can be used in legacy code paths.
func WithServiceIdentity(ctx context.Context, orgID int64) (context.Context, Requester) {
	r := newInternalIdentity(serviceName, "*", orgID)
	return WithRequester(ctx, r), r
}

func WithProvisioningIdentity(ctx context.Context, namespace string) (context.Context, Requester, error) {
	ns, err := types.ParseNamespace(namespace)
	if err != nil {
		return nil, nil, err
	}

	r := newInternalIdentity(serviceNameForProvisioning, ns.Value, ns.OrgID)
	return WithRequester(ctx, r), r, nil
}

// WithServiceIdentityContext sets an identity representing the service itself in context.
func WithServiceIdentityContext(ctx context.Context, orgID int64) context.Context {
	ctx, _ = WithServiceIdentity(ctx, orgID)
	return ctx
}

// WithServiceIdentityFN calls provided closure with an context contaning the identity of the service.
func WithServiceIdentityFn[T any](ctx context.Context, orgID int64, fn func(ctx context.Context) (T, error)) (T, error) {
	return fn(WithServiceIdentityContext(ctx, orgID))
}

func getWildcardPermissions(actions ...string) map[string][]string {
	permissions := make(map[string][]string, len(actions))
	for _, a := range actions {
		permissions[a] = []string{"*"}
	}
	return permissions
}

func getTokenPermissions(groups ...string) []string {
	out := make([]string, 0, len(groups))
	for _, group := range groups {
		out = append(out, group+":*")
	}
	return out
}

// serviceIdentityPermissions is a list of wildcard permissions for provided actions.
// We should add every action required "internally" here.
var serviceIdentityPermissions = getWildcardPermissions(
	"annotations:read",
	"folders:read",
	"folders:write",
	"folders:create",
	"folders:delete",
	"dashboards:read",
	"dashboards:write",
	"dashboards:create",
	"datasources:query",
	"datasources:read",
	"datasources:delete",
	"alert.provisioning:write",
	"alert.provisioning.secrets:read",
	"users:read",     // accesscontrol.ActionUsersRead,
	"org.users:read", // accesscontrol.ActionOrgUsersRead,
	"teams:read",     // accesscontrol.ActionTeamsRead,
)

var serviceIdentityTokenPermissions = getTokenPermissions(
	"folder.grafana.app",
	"dashboard.grafana.app",
	"secret.grafana.app",
)

var ServiceIdentityClaims = &authn.Claims[authn.AccessTokenClaims]{
	Rest: authn.AccessTokenClaims{
		Permissions:          serviceIdentityTokenPermissions,
		DelegatedPermissions: serviceIdentityTokenPermissions,
	},
}

func IsServiceIdentity(ctx context.Context) bool {
	ident, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return false
	}
	t, uid, err := types.ParseTypeID(ident.GetUID())
	if err != nil {
		return false
	}

	return t == types.TypeAccessPolicy && (uid == serviceName || uid == serviceNameForProvisioning)
}
