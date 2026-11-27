package legacypermissions

import (
	"context"
	"testing"

	authn "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

type remoteTestStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s remoteTestStream) Context() context.Context                             { return s.ctx }
func (s remoteTestStream) Send(*authzv1.LegacyGetUserPermissionsResponse) error { return nil }

func TestRemoteRejectsBeforeLoading(t *testing.T) {
	id := int64(7)
	valid := func() *authzv1.LegacyGetUserPermissionsRequest {
		return &authzv1.LegacyGetUserPermissionsRequest{Namespace: "stacks-1", Identity: &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "user-7", InternalId: &id}}
	}
	caller := func(ns string, grants ...string) context.Context {
		return types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: ns, Permissions: grants}}))
	}
	granted := caller("stacks-1", "authz.grafana.app/userpermissions:get")
	for _, tc := range []struct {
		name   string
		ctx    context.Context
		change func(*authzv1.LegacyGetUserPermissionsRequest)
		code   codes.Code
	}{
		{"missing caller", context.Background(), nil, codes.Unauthenticated},
		{"missing grant", caller("stacks-1"), nil, codes.PermissionDenied},
		{"old grant", caller("stacks-1", LegacyUserPermissionsGrant), nil, codes.PermissionDenied},
		{"wrong tenant", caller("stacks-2", "authz.grafana.app/userpermissions:get"), nil, codes.PermissionDenied},
		{"wildcard request", granted, func(r *authzv1.LegacyGetUserPermissionsRequest) { r.Namespace = "*" }, codes.InvalidArgument},
		{"missing identity", granted, func(r *authzv1.LegacyGetUserPermissionsRequest) { r.Identity = nil }, codes.InvalidArgument},
		{"missing UID", granted, func(r *authzv1.LegacyGetUserPermissionsRequest) { r.Identity.Uid = "" }, codes.InvalidArgument},
		{"conflicting flags", granted, func(r *authzv1.LegacyGetUserPermissionsRequest) { r.GlobalOrg = true; r.NoOrgMembership = true }, codes.InvalidArgument},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := valid()
			if tc.change != nil {
				tc.change(req)
			}
			err := NewRemoteServer(nil, nil, tracing.InitializeTracerForTest()).LegacyGetUserPermissions(req, remoteTestStream{ctx: tc.ctx})
			require.Equal(t, tc.code, status.Code(err))
		})
	}
}

func TestRemoteCacheIsolationAndRefresh(t *testing.T) {
	loader := &Loader{cache: localPermissionCache{cache: localcache.New(0, 0)}}
	for _, key := range []string{"rbac-permissions-basic-role-1-viewer", "rbac-permissions-team-1-7", "rbac-permissions-direct-same", "rbac-zanzana-permissions-same"} {
		for _, ns := range []string{"stacks-1", "stacks-2", "stacks-1"} {
			ctx := context.WithValue(context.Background(), remoteNamespaceKey{}, ns)
			got, err := loader.cached(ctx, "test", key, ac.Options{}, func(context.Context) ([]ac.Permission, error) { return []ac.Permission{{Action: ns}}, nil })
			require.NoError(t, err)
			require.Equal(t, ns, got[0].Action)
		}
		ctx := context.WithValue(context.Background(), remoteNamespaceKey{}, "stacks-1")
		_, err := loader.cached(ctx, "test", key, ac.Options{ReloadCache: true}, func(context.Context) ([]ac.Permission, error) { return []ac.Permission{{Action: "updated"}}, nil })
		require.NoError(t, err)
		ctx = context.WithValue(context.Background(), remoteNamespaceKey{}, "stacks-2")
		got, err := loader.cached(ctx, "test", key, ac.Options{}, func(context.Context) ([]ac.Permission, error) { t.Fatal("unexpected miss"); return nil, nil })
		require.NoError(t, err)
		require.Equal(t, "stacks-2", got[0].Action)
	}
}

func TestRemoteIdentityKeysIgnoreCallerCacheKey(t *testing.T) {
	id := &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "one"}
	before := testIdentityCacheKey(t, id, "stacks-1", 1)
	arbitrary := "arbitrary"
	id.CacheKey = &arbitrary
	require.Equal(t, before, testIdentityCacheKey(t, id, "stacks-1", 1))
	require.NotEqual(t, before, testIdentityCacheKey(t, id, "stacks-2", 1))
	require.NotEqual(t, before, testIdentityCacheKey(t, id, "stacks-1", 0))
	id.Uid = "two"
	require.NotEqual(t, before, testIdentityCacheKey(t, id, "stacks-1", 1))
}

func testIdentityCacheKey(t *testing.T, id *authzv1.LegacyPermissionIdentity, namespace string, orgID int64) string {
	t.Helper()
	key, err := remoteIdentityCacheKey(id, namespace, orgID)
	require.NoError(t, err)
	return key
}

func TestTeamSetCacheKey(t *testing.T) {
	require.Equal(t, teamSetCacheKey(1, []int64{1, 2}), teamSetCacheKey(1, []int64{1, 2}))
	require.NotEqual(t, teamSetCacheKey(1, []int64{1, 2}), teamSetCacheKey(2, []int64{1, 2}), "org")
	require.NotEqual(t, teamSetCacheKey(1, []int64{1, 2}), teamSetCacheKey(1, []int64{12}), "separator")
	many := make([]int64, 1000)
	for i := range many {
		many[i] = int64(1_000_000 + i)
	}
	ctx := context.WithValue(context.Background(), remoteNamespaceKey{}, "stacks-1234567890")
	require.Less(t, len(tenantCacheKey(ctx, teamSetCacheKey(1234567890, many))), 250)
}
