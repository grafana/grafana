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

type IdentityOpts func(*StaticRequester)

// WithServiceIdentityName sets the `StaticRequester.AccessTokenClaims.Rest.ServiceIdentity` field to the provided name.
// This is so far only used by Secrets Manager to identify and gate the service decrypting a secret.
func WithServiceIdentityName(name string) IdentityOpts {
	return func(r *StaticRequester) {
		r.AccessTokenClaims.Rest.ServiceIdentity = name
	}
}

func newInternalIdentity(name string, namespace string, orgID int64, opts ...IdentityOpts) Requester {
	// Create a copy of the ServiceIdentityClaims to avoid modifying the global one.
	// Some of the options might mutate it.
	claimsCopy := *ServiceIdentityClaims

	staticRequester := &StaticRequester{
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
		AccessTokenClaims: &claimsCopy,
	}

	for _, opt := range opts {
		opt(staticRequester)
	}

	return staticRequester
}

// WithServiceIdentity sets an identity representing the service itself in provided org and store it in context.
// This is useful for background tasks that has to communicate with unfied storage. It also returns a Requester with
// static permissions so it can be used in legacy code paths.
func WithServiceIdentity(ctx context.Context, orgID int64, opts ...IdentityOpts) (context.Context, Requester) {
	r := newInternalIdentity(serviceName, "*", orgID, opts...)
	return WithRequester(ctx, r), r
}

func WithProvisioningIdentity(ctx context.Context, namespace string, opts ...IdentityOpts) (context.Context, Requester, error) {
	ns, err := types.ParseNamespace(namespace)
	if err != nil {
		return nil, nil, err
	}

	r := newInternalIdentity(serviceNameForProvisioning, ns.Value, ns.OrgID, opts...)
	return WithRequester(ctx, r), r, nil
}

// WithServiceIdentityContext sets an identity representing the service itself in context.
func WithServiceIdentityContext(ctx context.Context, orgID int64, opts ...IdentityOpts) context.Context {
	ctx, _ = WithServiceIdentity(ctx, orgID, opts...)
	return ctx
}

// WithServiceIdentityFN calls provided closure with an context contaning the identity of the service.
func WithServiceIdentityFn[T any](ctx context.Context, orgID int64, fn func(ctx context.Context) (T, error), opts ...IdentityOpts) (T, error) {
	return fn(WithServiceIdentityContext(ctx, orgID, opts...))
}

func getWildcardPermissions(actions ...string) map[string][]string {
	permissions := make(map[string][]string, len(actions))
	for _, a := range actions {
		permissions[a] = []string{"*"}
	}
	return permissions
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
	"users:read",           // accesscontrol.ActionUsersRead,
	"org.users:read",       // accesscontrol.ActionOrgUsersRead,
	"teams:read",           // accesscontrol.ActionTeamsRead,
	"serviceaccounts:read", // serviceaccounts.ActionRead,
)

var serviceIdentityTokenPermissions = []string{
	"folder.grafana.app:*",
	"dashboard.grafana.app:*",
	"secret.grafana.app:*",
	"query.grafana.app:*",
	"iam.grafana.app:*",

	// Secrets Manager uses a custom verb for secret decryption, and its authorizer does not allow wildcard permissions.
	"secret.grafana.app/securevalues:decrypt",
}

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
