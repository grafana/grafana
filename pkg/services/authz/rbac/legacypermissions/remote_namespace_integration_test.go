package legacypermissions_test

import (
	"context"
	"testing"

	authn "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/apiserver/pkg/endpoints/request"
)

type namespaceResolver struct {
	t          *testing.T
	namespaces []string
}

func (r *namespaceResolver) ResolveCurrentUserPermissions(ctx context.Context, user identity.Requester, _ bool) ([]ac.Permission, error) {
	require.Equal(r.t, "default", request.NamespaceValue(ctx))
	r.namespaces = append(r.namespaces, user.GetNamespace())
	return nil, nil
}

type namespaceStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s namespaceStream) Context() context.Context                             { return s.ctx }
func (s namespaceStream) Send(*authzv1.LegacyGetUserPermissionsResponse) error { return nil }

func TestIntegrationRemotePreservesRequesterNamespace(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	sql := db.NewTestStore(t)
	seedRemoteIdentity(t, sql)
	resolver := &namespaceResolver{t: t}
	loader := legacypermissions.NewEnforcedLoader(func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "default", request.NamespaceValue(ctx))
		return legacysql.NewDatabaseProvider(sql)(ctx)
	}, resourcepermissions.NewActionSetService(), localcache.New(0, 0), loaderConfig(true), featuremgmt.WithFeatures(), resolver, nil)
	server := legacypermissions.NewRemoteServer(loader, nil, tracing.InitializeTracerForTest())
	ctx := types.WithAuthInfo(context.Background(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "default", Permissions: []string{"authz.grafana.app/userpermissions:get"}}}))
	for _, tc := range []struct {
		namespace     string
		global, noOrg bool
	}{{"org-0", true, false}, {"default", true, false}, {"org--1", false, true}, {"", true, false}} {
		original := tc.namespace
		req := &authzv1.LegacyGetUserPermissionsRequest{Namespace: "default", GlobalOrg: tc.global, NoOrgMembership: tc.noOrg, Identity: &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "user-7", RequesterNamespace: &original}}
		require.NoError(t, server.LegacyGetUserPermissions(req, namespaceStream{ctx: ctx}))
		require.Equal(t, original, req.Identity.GetRequesterNamespace())
	}
	require.Equal(t, []string{"org-0", "default", "org--1", ""}, resolver.namespaces)
}
