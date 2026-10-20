package resource

import (
	"context"
	"errors"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	tenantGroup = "myapp.stacks-1.gas.ext.grafana.app"
	tenantKind  = "books"
)

// authzServiceConn stands in for the authz service behind authlib's real
// client, which checks service permissions again before calling it. It allows
// everything and records the groups it is asked about.
type authzServiceConn struct {
	groups []string
}

func (c *authzServiceConn) Invoke(_ context.Context, _ string, args, reply any, _ ...grpc.CallOption) error {
	switch req := args.(type) {
	case *authzv1.CheckRequest:
		c.groups = append(c.groups, req.Group)
		reply.(*authzv1.CheckResponse).Allowed = true
	case *authzv1.ListRequest:
		c.groups = append(c.groups, req.Group)
		reply.(*authzv1.ListResponse).All = true
	case *authzv1.BatchCheckRequest:
		results := map[string]*authzv1.BatchCheckResult{}
		for _, check := range req.Checks {
			c.groups = append(c.groups, check.Group)
			results[check.CorrelationId] = &authzv1.BatchCheckResult{Allowed: true}
		}
		reply.(*authzv1.BatchCheckResponse).Results = results
	default:
		return errors.New("unexpected request")
	}
	return nil
}

func (c *authzServiceConn) NewStream(context.Context, *grpc.StreamDesc, string, ...grpc.CallOption) (grpc.ClientStream, error) {
	return nil, errors.New("not supported")
}

func newLimitedAuthlibClient(t *testing.T) (*authzLimitedClient, *authzServiceConn) {
	t.Helper()
	conn := &authzServiceConn{}
	c, ok := NewAuthzLimitedClient(authz.NewClient(conn), AuthzOptions{Registry: prometheus.NewRegistry()}).(*authzLimitedClient)
	require.True(t, ok)
	return c, conn
}

// A namespaced group of the request's namespace is granted through a token
// permission for its owner's whole group, since no token can name it. Every
// entry point reaches authlib's client, which re-checks service permissions,
// and the authz service, which still sees the namespaced group.
func TestAuthzLimitedClient_NamespacedGroups(t *testing.T) {
	for name, tc := range map[string]struct {
		id    authlib.AuthInfo
		group string
		// wantErr is the error every entry point returns; nil means allowed.
		wantErr error
	}{
		// What every session user's token carries (AccessClaimsHook).
		"delegated plugin group wildcard": {
			id: userWithDelegatedPermissions("*.ext.grafana.app:*"), group: tenantGroup,
		},
		"delegated owner group": {
			id: userWithDelegatedPermissions("gas.ext.grafana.app:*"), group: tenantGroup,
		},
		"delegated namespaced group itself": {
			id: userWithDelegatedPermissions(tenantGroup + ":*"), group: tenantGroup,
		},
		"service owner group": {
			id: serviceWithPermissions("gas.ext.grafana.app:*"), group: tenantGroup,
		},
		"service plugin group wildcard": {
			id: serviceWithPermissions("*.ext.grafana.app:*"), group: tenantGroup,
		},
		"another owner's group": {
			id: userWithDelegatedPermissions("other.ext.grafana.app:*"), group: tenantGroup,
			wantErr: ErrServiceCannotDelegate,
		},
		// The owner's resources are not the namespaced group's.
		"owner resource": {
			id: serviceWithPermissions("gas.ext.grafana.app/books:*"), group: tenantGroup,
			wantErr: ErrServicePermissionMissing,
		},
		"owner group, other verb": {
			id: serviceWithPermissions("gas.ext.grafana.app:delete"), group: tenantGroup,
			wantErr: ErrServicePermissionMissing,
		},
		// Only a group that names the request's namespace maps to its owner.
		"another namespace's group": {
			id: userWithDelegatedPermissions("*.ext.grafana.app:*"), group: "myapp.stacks-2.gas.ext.grafana.app",
			wantErr: ErrServiceCannotDelegate,
		},
		"plugin group with two labels": {
			id: userWithDelegatedPermissions("*.ext.grafana.app:*"), group: "myapp.other.ext.grafana.app",
			wantErr: ErrServiceCannotDelegate,
		},
	} {
		t.Run(name, func(t *testing.T) {
			check := func(t *testing.T, err error, allowed bool, conn *authzServiceConn) {
				t.Helper()
				if tc.wantErr != nil {
					require.ErrorIs(t, err, tc.wantErr)
					assert.Empty(t, conn.groups)
					return
				}
				require.NoError(t, err)
				assert.True(t, allowed)
				if authlib.IsIdentityType(tc.id.GetIdentityType(), authlib.TypeAccessPolicy) {
					// Decided by its token alone.
					assert.Empty(t, conn.groups)
				} else {
					assert.Equal(t, []string{tc.group}, conn.groups)
				}
			}

			t.Run("Check", func(t *testing.T) {
				c, conn := newLimitedAuthlibClient(t)
				resp, err := c.Check(t.Context(), tc.id, authlib.CheckRequest{
					Namespace: "stacks-1", Group: tc.group, Resource: tenantKind, Verb: utils.VerbCreate, Name: "b1",
				}, "")
				check(t, err, resp.Allowed, conn)
			})

			t.Run("Compile", func(t *testing.T) {
				c, conn := newLimitedAuthlibClient(t)
				checker, _, err := c.Compile(t.Context(), tc.id, authlib.ListRequest{
					Namespace: "stacks-1", Group: tc.group, Resource: tenantKind, Verb: utils.VerbList,
				})
				check(t, err, err == nil && checker("b1", ""), conn)
			})

			t.Run("BatchCheck", func(t *testing.T) {
				c, conn := newLimitedAuthlibClient(t)
				resp, err := c.BatchCheck(t.Context(), tc.id, authlib.BatchCheckRequest{
					Namespace: "stacks-1",
					Checks: []authlib.BatchCheckItem{
						{CorrelationID: "1", Group: tc.group, Resource: tenantKind, Verb: utils.VerbCreate, Name: "b1"},
					},
				})
				check(t, err, resp.Results["1"].Allowed, conn)
			})
		})
	}
}

func TestWithNamespacedGroupGrants(t *testing.T) {
	grant := servicePermission(tenantGroup, tenantKind, utils.VerbCreate)

	t.Run("a user's token delegates the grant", func(t *testing.T) {
		id := userWithDelegatedPermissions("*.ext.grafana.app:*")
		got := withNamespacedGroupGrants(id, grant)
		assert.Equal(t, []string{"*.ext.grafana.app:*", grant}, got.GetTokenDelegatedPermissions())
		assert.Empty(t, got.GetTokenPermissions())
		// The caller's identity is unchanged.
		assert.Equal(t, []string{"*.ext.grafana.app:*"}, id.GetTokenDelegatedPermissions())
		_, ok := got.(identity.Requester)
		assert.True(t, ok, "a requester stays one")
		assert.Equal(t, id.GetSubject(), got.GetSubject())
	})

	t.Run("a service's token holds the grant", func(t *testing.T) {
		got := withNamespacedGroupGrants(serviceWithPermissions("gas.ext.grafana.app:*"), grant)
		assert.Equal(t, []string{"gas.ext.grafana.app:*", grant}, got.GetTokenPermissions())
		assert.Empty(t, got.GetTokenDelegatedPermissions())
	})

	t.Run("any other identity keeps its type", func(t *testing.T) {
		id := authInfoOnly{serviceWithPermissions("gas.ext.grafana.app:*")}
		got := withNamespacedGroupGrants(id, grant)
		_, ok := got.(identity.Requester)
		assert.False(t, ok)
		assert.Equal(t, []string{"gas.ext.grafana.app:*", grant}, got.GetTokenPermissions())
	})
}

// authInfoOnly hides everything but the AuthInfo methods of its identity.
type authInfoOnly struct{ authlib.AuthInfo }

func TestCheckServiceTokenPermissions_NamespacedGroups(t *testing.T) {
	id := userWithDelegatedPermissions("*.ext.grafana.app:*")

	viaOwner, err := checkServiceTokenPermissions(id, "stacks-1", tenantGroup, tenantKind, utils.VerbGet)
	require.NoError(t, err)
	assert.True(t, viaOwner)

	// A plugin group the wildcard matches itself needs no owner.
	viaOwner, err = checkServiceTokenPermissions(id, "stacks-1", "gas.ext.grafana.app", "apps", utils.VerbGet)
	require.NoError(t, err)
	assert.False(t, viaOwner)

	for _, namespace := range []string{"", "*", "stacks-2"} {
		_, err := checkServiceTokenPermissions(id, namespace, tenantGroup, tenantKind, utils.VerbGet)
		require.ErrorIs(t, err, ErrServiceCannotDelegate, "namespace %q", namespace)
	}
}
