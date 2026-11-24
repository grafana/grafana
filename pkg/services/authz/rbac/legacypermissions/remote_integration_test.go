package legacypermissions_test

import (
	"context"
	"errors"
	"io"
	"net"
	"testing"
	"time"

	authn "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	grpcAuth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type remoteIntegrationServer struct {
	authzv1.UnimplementedLegacyAuthzServiceServer
	handler *legacypermissions.RemoteServer
}

func (s *remoteIntegrationServer) LegacyGetUserPermissions(r *authzv1.LegacyGetUserPermissionsRequest, stream authzv1.LegacyAuthzService_LegacyGetUserPermissionsServer) error {
	return s.handler.LegacyGetUserPermissions(r, stream)
}

func seedRemoteIdentity(t *testing.T, sql db.DB) {
	t.Helper()
	now := time.Now()
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Insert(&user.User{ID: 7, UID: "user-7", Login: "remote-user", Email: "remote@example.com", Created: now, Updated: now},
			&org.OrgUser{OrgID: 1, UserID: 7, Role: org.RoleViewer, Created: now, Updated: now},
			&team.Team{ID: 9, UID: "team-9", OrgID: 1, Name: "remote-team", Created: now, Updated: now},
			&team.TeamMember{OrgID: 1, UserID: 7, TeamID: 9, Created: now, Updated: now})
		return err
	}))
}

func TestIntegrationRemoteLegacyPermissionsGRPC(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	providers := map[string]legacysql.LegacyDatabaseProvider{}
	for _, ns := range []string{"stacks-1", "stacks-2"} {
		sql := db.NewTestStore(t)
		seedRemoteIdentity(t, sql)
		seedGrant(t, sql, "custom:tenant", 1, 7, ac.Permission{Action: "dashboards:read", Scope: "dashboards:uid:" + ns})
		require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
			now := time.Now()
			for _, kind := range []string{"basic", "team"} {
				role := ac.Role{Name: kind + ":tenant", UID: kind + "-tenant", OrgID: 1, Created: now, Updated: now}
				if _, err := sess.Insert(&role); err != nil {
					return err
				}
				if _, err := sess.Insert(&ac.Permission{RoleID: role.ID, Action: "dashboards:read", Scope: "dashboards:uid:" + ns + "-" + kind, Created: now, Updated: now}); err != nil {
					return err
				}
				if kind == "basic" {
					if _, err := sess.Insert(&ac.BuiltinRole{Role: "Viewer", OrgID: 1, RoleID: role.ID, Created: now, Updated: now}); err != nil {
						return err
					}
				} else {
					if _, err := sess.Insert(&ac.TeamRole{TeamID: 9, OrgID: 1, RoleID: role.ID, Created: now}); err != nil {
						return err
					}
				}
			}
			return nil
		}))
		providers[ns] = legacysql.NewDatabaseProvider(sql)
	}
	loader := legacypermissions.NewEnforcedLoader(func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		provider := providers[request.NamespaceValue(ctx)]
		if provider == nil {
			return nil, status.Error(codes.Internal, "unexpected tenant")
		}
		return provider(ctx)
	}, resourcepermissions.NewActionSetService(), localcache.New(0, 0), loaderConfig(true), featuremgmt.WithFeatures(), nil, nil)
	listener := bufconn.Listen(1024 * 1024)
	// The fixture authenticates a fixed test credential through the production interceptor adapter.
	authenticate := func(ctx context.Context) (context.Context, error) {
		md, _ := metadata.FromIncomingContext(ctx)
		if len(md.Get("authorization")) != 1 || md.Get("authorization")[0] != "test-credential" {
			return nil, status.Error(codes.Unauthenticated, "invalid test credential")
		}
		return types.WithAuthInfo(ctx, authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "*", Permissions: []string{"authz.grafana.app/userpermissions:get"}}})), nil
	}
	server := grpc.NewServer(grpc.StreamInterceptor(grpcAuth.StreamServerInterceptor(authenticate)))
	authzv1.RegisterLegacyAuthzServiceServer(server, &remoteIntegrationServer{handler: legacypermissions.NewRemoteServer(loader, nil, tracing.InitializeTracerForTest())})
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	t.Cleanup(func() { _ = listener.Close() })
	connection, err := grpc.NewClient("passthrough:///remote-test", grpc.WithTransportCredentials(insecure.NewCredentials()), grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }))
	require.NoError(t, err)
	t.Cleanup(func() { _ = connection.Close() })
	client := authzv1.NewLegacyAuthzServiceClient(connection)
	id := int64(999)
	maliciousKey := "same-key"
	for _, ns := range []string{"stacks-1", "stacks-2", "stacks-1", "stacks-2"} {
		req := &authzv1.LegacyGetUserPermissionsRequest{Namespace: ns, Identity: &authzv1.LegacyPermissionIdentity{Type: "user", Uid: "user-7", InternalId: &id, HasUniqueId: false, OrgRole: "Admin", IsGrafanaAdmin: true, TeamIds: []int64{999}, CacheKey: &maliciousKey}}
		//nolint:staticcheck // Exercise the transitional RPC directly, without its wrapper client.
		stream, err := client.LegacyGetUserPermissions(context.Background(), req)
		require.NoError(t, err)
		_, err = stream.Recv()
		require.Equal(t, codes.Unauthenticated, status.Code(err))
		ctx := metadata.NewOutgoingContext(context.Background(), metadata.Pairs("authorization", "test-credential"))
		//nolint:staticcheck // Exercise the transitional RPC directly, without its wrapper client.
		stream, err = client.LegacyGetUserPermissions(ctx, req)
		require.NoError(t, err)
		var permissions []ac.Permission
		for {
			chunk, err := stream.Recv()
			if errors.Is(err, io.EOF) {
				break
			}
			require.NoError(t, err)
			for _, p := range chunk.Permissions {
				permissions = append(permissions, ac.Permission{Action: p.Action, Scope: p.Scope})
			}
		}
		require.ElementsMatch(t, []ac.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:" + ns}, {Action: "folders:read", Scope: "folders:uid:sharedwithme"}, {Action: "dashboards:read", Scope: "dashboards:uid:" + ns + "-basic"}, {Action: "dashboards:read", Scope: "dashboards:uid:" + ns + "-team"}}, permissions)
	}
}
