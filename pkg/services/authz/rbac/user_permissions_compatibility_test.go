package rbac_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/cache"
	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) { testsuite.Run(m) }

type localPermissionsFeatures struct{}

func (localPermissionsFeatures) UserPermissionsAPIEnabled() bool { return false }

type authenticatedPermissionStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s authenticatedPermissionStream) Context() context.Context { return s.ctx }

// Use the existing generated client over serialized gRPC, not the new legacy
// client. Both evaluators must preserve the contract of the already shipped RPC.
func permissionRPC(t *testing.T, sql db.DB, evaluator ac.UserPermissionsEvaluator, caller types.AuthInfo) authzv1.AuthzServiceClient {
	t.Helper()
	tracer := tracing.InitializeTracerForTest()
	provider := legacysql.NewDatabaseProvider(sql)
	service := rbac.NewService(provider, nil, legacy.NewLegacySQLStores(provider),
		store.NewSQLPermissionStore(provider, tracer), evaluator, nil, nil,
		log.New("permission-contract"), tracer, prometheus.NewRegistry(),
		cache.NewLocalCache(cache.Config{Expiry: time.Minute, CleanupInterval: time.Minute}),
		rbac.Settings{AnonOrgRole: "Viewer", CacheTTL: time.Minute})
	server := grpc.NewServer(grpc.StreamInterceptor(func(srv any, stream grpc.ServerStream, _ *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		ctx := stream.Context()
		if caller != nil {
			ctx = types.WithAuthInfo(ctx, caller)
		}
		return handler(srv, authenticatedPermissionStream{stream, ctx})
	}))
	authzv1.RegisterAuthzServiceServer(server, service)
	listener := bufconn.Listen(1024 * 1024)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(func() { server.Stop(); _ = listener.Close() })
	conn, err := grpc.NewClient("passthrough:///permissions", grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) { return listener.DialContext(ctx) }))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, conn.Close()) })
	return authzv1.NewAuthzServiceClient(conn)
}

func permissionSnapshot(ctx context.Context, client authzv1.AuthzServiceClient, request *authzv1.GetUserPermissionsRequest) ([]ac.Permission, []int, error) {
	stream, err := client.GetUserPermissions(ctx, request)
	if err != nil {
		return nil, nil, err
	}
	var permissions []ac.Permission
	var chunks []int
	for {
		chunk, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			return permissions, chunks, nil
		}
		if err != nil {
			return permissions, chunks, err
		}
		chunks = append(chunks, len(chunk.Permissions))
		for _, permission := range chunk.Permissions {
			permissions = append(permissions, ac.Permission{Action: permission.Action, Scope: permission.Scope})
		}
	}
}

func TestIntegrationUserPermissionsRPCCompatibility(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cached := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cached), func(t *testing.T) {
			sql := db.NewTestStore(t)
			cfg := setting.NewCfg()
			cfg.RBAC.PermissionCache = cached
			features := featuremgmt.WithFeatures()
			actions := resourcepermissions.NewActionSetService()
			actions.StoreActionSet("contract:view", []string{"contract:read", "contract:inspect"})
			catalog := legacypermissions.NewRoleCatalog()
			previous := acimpl.ProvideOSSService(cfg, database.ProvideService(sql), actions, localcache.New(0, 0),
				features, tracing.InitializeTracerForTest(), sql, nil, nil, localPermissionsFeatures{}, nil, catalog)
			loader := legacypermissions.NewLoader(sql, catalog, actions, localcache.New(0, 0), cfg, features, &licensing.OSSLicensingService{}, nil)
			caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
				Claims: jwt.Claims{Subject: "access-policy:grafana"},
				Rest:   authn.AccessTokenClaims{Namespace: "default", Permissions: []string{"authz.grafana.app/userpermissions:get"}},
			})
			oldRPC, newRPC := permissionRPC(t, sql, previous, caller), permissionRPC(t, sql, loader, caller)
			now := time.Now()
			var roleID int64
			require.NoError(t, sql.WithDbSession(t.Context(), func(session *db.Session) error {
				for _, id := range []int64{7, 8} {
					if _, err := session.Insert(&user.User{ID: id, UID: fmt.Sprintf("actor-%d", id), Login: fmt.Sprintf("actor-%d", id), Email: fmt.Sprintf("actor-%d@example.test", id), IsServiceAccount: id == 8, Created: now, Updated: now}); err != nil {
						return err
					}
					if _, err := session.Insert(&org.OrgUser{UserID: id, OrgID: 1, Role: org.RoleViewer, Created: now, Updated: now}); err != nil {
						return err
					}
				}
				role := ac.Role{UID: "rpc-role", Name: "managed:rpc-role", OrgID: 1, Created: now, Updated: now}
				if _, err := session.Insert(&role); err != nil {
					return err
				}
				roleID = role.ID
				if _, err := session.Insert(&ac.BuiltinRole{RoleID: role.ID, OrgID: 1, Role: "Viewer", Created: now, Updated: now}); err != nil {
					return err
				}
				for _, grant := range []ac.Permission{{Action: "contract:view", Scope: "contract:uid:one"}, {Action: "contract:read", Scope: "contract:uid:one"}, {Action: "contract:create"}} {
					grant.RoleID, grant.Created, grant.Updated = role.ID, now, now
					if _, err := session.Insert(&grant); err != nil {
						return err
					}
				}
				return nil
			}))
			want := []ac.Permission{{Action: "contract:read", Scope: "contract:uid:one"}, {Action: "contract:inspect", Scope: "contract:uid:one"}, {Action: "contract:create"}, {Action: "folders:read", Scope: "folders:uid:sharedwithme"}}
			for _, subject := range []string{"user:actor-7", "user:7", "service-account:actor-8", "anonymous:0", "render:0"} {
				t.Run(subject, func(t *testing.T) {
					for _, skip := range []bool{false, false, true} {
						req := &authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: subject, Teams: []string{"contextual-team"}, Options: &authzv1.GetUserPermissionsOptions{Skipcache: skip}}
						before, beforeChunks, beforeErr := permissionSnapshot(t.Context(), oldRPC, req)
						after, afterChunks, afterErr := permissionSnapshot(t.Context(), newRPC, req)
						require.NoError(t, beforeErr)
						require.NoError(t, afterErr)
						require.ElementsMatch(t, before, after)
						require.Equal(t, beforeChunks, afterChunks)
						if subject != "render:0" {
							require.ElementsMatch(t, want, after)
						} else {
							require.ElementsMatch(t, []ac.Permission{
								{Action: "dashboards:read", Scope: "*"},
								{Action: "folders:read", Scope: "*"},
								{Action: "datasources:read", Scope: "*"},
								{Action: "datasources:query", Scope: "*"},
								{Action: "plugins.metas:read", Scope: "*"},
								{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
							}, after)
						}
					}
				})
			}
			for _, invalid := range []struct {
				req  *authzv1.GetUserPermissionsRequest
				code codes.Code
			}{
				{&authzv1.GetUserPermissionsRequest{Namespace: "org-2", Subject: "user:actor-7"}, codes.PermissionDenied},
				{&authzv1.GetUserPermissionsRequest{Subject: "user:actor-7"}, codes.InvalidArgument},
				{&authzv1.GetUserPermissionsRequest{Namespace: "default"}, codes.InvalidArgument},
				{&authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "api-key:7"}, codes.PermissionDenied},
				{&authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "user:missing"}, codes.Unknown},
			} {
				before, _, beforeErr := permissionSnapshot(t.Context(), oldRPC, invalid.req)
				after, _, afterErr := permissionSnapshot(t.Context(), newRPC, invalid.req)
				require.Equal(t, invalid.code, status.Code(afterErr))
				require.Error(t, beforeErr)
				require.Error(t, afterErr)
				require.Equal(t, status.Code(beforeErr), status.Code(afterErr))
				require.Equal(t, status.Convert(beforeErr).Message(), status.Convert(afterErr).Message())
				require.Empty(t, before)
				require.Empty(t, after)
			}

			req := &authzv1.GetUserPermissionsRequest{Namespace: "default", Subject: "user:actor-7"}
			for _, auth := range []struct {
				caller types.AuthInfo
				code   codes.Code
			}{
				{nil, codes.Internal},
				{authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "default"}}), codes.PermissionDenied},
			} {
				for _, evaluator := range []ac.UserPermissionsEvaluator{previous, loader} {
					permissions, chunks, err := permissionSnapshot(t.Context(), permissionRPC(t, sql, evaluator, auth.caller), req)
					require.Equal(t, auth.code, status.Code(err))
					require.Empty(t, permissions)
					require.Empty(t, chunks)
				}
			}
			for _, client := range []authzv1.AuthzServiceClient{oldRPC, newRPC} {
				ctx, cancel := context.WithCancel(t.Context())
				cancel()
				_, _, err := permissionSnapshot(ctx, client, req)
				require.Equal(t, codes.Canceled, status.Code(err))
				ctx, cancel = context.WithDeadline(t.Context(), time.Now().Add(-time.Second))
				_, _, err = permissionSnapshot(ctx, client, req)
				cancel()
				require.Equal(t, codes.DeadlineExceeded, status.Code(err))
			}

			// Warm contribution caches must remain stale until a requested reload.
			// A refresh also exercises chunking of the deduplicated snapshot.
			require.NoError(t, sql.WithDbSession(t.Context(), func(session *db.Session) error {
				for i := range 2501 {
					grant := ac.Permission{RoleID: roleID, Action: "contract:large", Scope: fmt.Sprintf("contract:uid:%d", i), Created: now, Updated: now}
					if _, err := session.Insert(&grant); err != nil {
						return err
					}
				}
				return nil
			}))
			for _, skip := range []bool{false, true} {
				req.Options = &authzv1.GetUserPermissionsOptions{Skipcache: skip}
				before, beforeChunks, beforeErr := permissionSnapshot(t.Context(), oldRPC, req)
				after, afterChunks, afterErr := permissionSnapshot(t.Context(), newRPC, req)
				require.NoError(t, beforeErr)
				require.NoError(t, afterErr)
				require.ElementsMatch(t, before, after)
				require.Equal(t, beforeChunks, afterChunks)
				if cached && !skip {
					require.ElementsMatch(t, want, after)
				} else {
					require.Len(t, after, 2505)
					require.Equal(t, []int{1000, 1000, 505}, afterChunks)
				}
			}
			require.NoError(t, sql.WithDbSession(t.Context(), func(session *db.Session) error {
				_, err := session.Exec("DROP TABLE permission")
				return err
			}))
			for _, client := range []authzv1.AuthzServiceClient{oldRPC, newRPC} {
				permissions, chunks, err := permissionSnapshot(t.Context(), client, req)
				require.Equal(t, codes.Unknown, status.Code(err))
				require.Empty(t, permissions)
				require.Empty(t, chunks)
			}
		})
	}
}
