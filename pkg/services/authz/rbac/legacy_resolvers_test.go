package rbac

import (
	"context"
	"errors"
	"net"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"
	"google.golang.org/protobuf/proto"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestLegacyCheckResolverParity(t *testing.T) {
	for _, tc := range []struct {
		name        string
		expression  *authzextv1.LegacyExpression
		permissions []accesscontrol.Permission
		skip        bool
		allowed     bool
		wantError   bool
		calls       []string
	}{
		{
			name:       "empty all allows an identity with only shared with me",
			expression: legacyAllExpression(),
			skip:       false,
			allowed:    true,
			wantError:  false,
		},
		{
			name:       "empty all allows an identity with unrelated grants",
			expression: legacyAllExpression(),
			permissions: []accesscontrol.Permission{
				{
					Action: "users:create",
					Scope:  "",
				},
			},
			skip:      false,
			allowed:   true,
			wantError: false,
		},
		{
			name:       "empty any denies without resolver work",
			expression: legacyAnyExpression(),
			permissions: []accesscontrol.Permission{
				{
					Action: "users:create",
					Scope:  "",
				},
			},
			skip:      false,
			allowed:   false,
			wantError: false,
		},
		{
			name:       "wildcard avoids lookup of missing resource",
			expression: legacyPermissionExpression("dashboards:read", "dashboards:uid:missing"),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "dashboards:*",
				},
			},
			skip:      false,
			allowed:   true,
			wantError: false,
		},
		{
			name: "whole any succeeds before resolution",
			expression: legacyAnyExpression(
				legacyPermissionExpression("dashboards:read", "dashboards:uid:missing"),
				legacyPermissionExpression("users:create"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "users:create",
					Scope:  "",
				},
			},
			skip:      false,
			allowed:   true,
			wantError: false,
		},
		{
			name:       "inheritance after denial",
			expression: legacyPermissionExpression("dashboards:read", "dashboards:uid:one"),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "folders:uid:parent",
				},
			},
			skip:      false,
			allowed:   true,
			wantError: false,
			calls:     []string{"dashboards:uid:one"},
		},
		{
			name: "all retains an unresolvable child",
			expression: legacyAllExpression(
				legacyPermissionExpression("users:create"),
				legacyPermissionExpression("dashboards:read", "dashboards:uid:one"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "users:create",
					Scope:  "",
				},
				{
					Action: "dashboards:read",
					Scope:  "folders:uid:parent",
				},
			},
			skip:      false,
			allowed:   true,
			wantError: false,
			calls:     []string{"dashboards:uid:one"},
		},
		{
			name: "nested any still resolves a later failing child",
			expression: legacyAllExpression(legacyAnyExpression(
				legacyPermissionExpression("dashboards:read", "dashboards:uid:one"),
				legacyPermissionExpression("dashboards:read", "dashboards:uid:missing"),
			)),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "folders:uid:parent",
				},
			},
			skip:      false,
			allowed:   false,
			wantError: true,
			calls:     []string{"dashboards:uid:one", "dashboards:uid:missing"},
		},
		{
			name: "failure stops mutation",
			expression: legacyAllExpression(
				legacyPermissionExpression("dashboards:read", "dashboards:uid:missing"),
				legacyPermissionExpression("dashboards:read", "dashboards:uid:one"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "folders:uid:parent",
				},
			},
			skip:      false,
			allowed:   false,
			wantError: true,
			calls:     []string{"dashboards:uid:missing"},
		},
		{
			name:       "shared with me still enables resolution without stored grants",
			expression: legacyPermissionExpression("dashboards:read", "dashboards:uid:missing"),
			skip:       false,
			allowed:    false,
			wantError:  true,
			calls:      []string{"dashboards:uid:missing"},
		},
		{
			name:       "unrelated permissions still expose a resolver failure",
			expression: legacyPermissionExpression("dashboards:read", "dashboards:uid:missing"),
			permissions: []accesscontrol.Permission{
				{
					Action: "users:create",
					Scope:  "",
				},
			},
			skip:      false,
			allowed:   false,
			wantError: true,
			calls:     []string{"dashboards:uid:missing"},
		},
		{
			name:       "action only has no resolver work",
			expression: legacyPermissionExpression("dashboards:read"),
			permissions: []accesscontrol.Permission{
				{
					Action: "users:create",
					Scope:  "",
				},
			},
			skip:      false,
			allowed:   false,
			wantError: false,
		},
		{
			name:       "unknown prefix denies normally",
			expression: legacyPermissionExpression("dashboards:read", "unknown:id:one"),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "folders:uid:parent",
				},
			},
			skip:      false,
			allowed:   false,
			wantError: false,
		},
		{
			name:       "resolver not found sentinel denies normally",
			expression: legacyPermissionExpression("dashboards:read", "dashboards:uid:unsupported"),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "folders:uid:parent",
				},
			},
			skip:      false,
			allowed:   false,
			wantError: false,
			calls:     []string{"dashboards:uid:unsupported"},
		},
		{
			name:       "skip scope resolution matches WithoutResolvers",
			expression: legacyPermissionExpression("dashboards:read", "dashboards:uid:one"),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "folders:uid:parent",
				},
			},
			skip:      true,
			allowed:   false,
			wantError: false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls []string
			resolve := func(scope string) ([]string, error) {
				calls = append(calls, scope)
				switch scope {
				case "dashboards:uid:missing":
					return nil, errors.New("metadata unavailable")
				case "dashboards:uid:unsupported":
					return nil, accesscontrol.ErrResolverNotFound
				default:
					return []string{scope, "folders:uid:parent"}, nil
				}
			}
			ac := acimpl.ProvideAccessControlTest()
			ac.RegisterScopeAttributeResolver("dashboards:uid:", accesscontrol.ScopeAttributeResolverFunc(
				func(_ context.Context, orgID int64, scope string) ([]string, error) {
					require.Equal(t, int64(12), orgID)
					return resolve(scope)
				},
			))
			var reference accesscontrol.AccessControl = ac
			if tc.skip {
				reference = ac.WithoutResolvers()
			}
			evaluator, _, err := convertLegacyExpression(tc.expression)
			require.NoError(t, err)
			permissions := map[string][]string{
				acimpl.SharedWithMeFolderPermission.Action: {acimpl.SharedWithMeFolderPermission.Scope},
			}
			for _, p := range tc.permissions {
				permissions[p.Action] = append(permissions[p.Action], p.Scope)
			}
			allowed, referenceErr := reference.Evaluate(t.Context(), &user.SignedInUser{
				UserID:      1,
				UserUID:     "u-1",
				OrgID:       12,
				Permissions: map[int64]map[string][]string{12: permissions},
			}, evaluator)
			require.Equal(t, tc.allowed, allowed)
			require.Equal(t, tc.wantError, referenceErr != nil)
			require.Equal(t, tc.calls, calls)

			calls = nil
			s := NewTestService("u-1", tc.permissions, nil).
				WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
			gotAllowed, gotErr := s.evaluateLegacyWithResolvers(
				request.WithNamespace(t.Context(), "org-12"),
				evaluator,
				permissions,
				len(permissions) > 0,
				tc.skip,
				legacyScopeRequest{
					identityType: types.TypeUser,
					userUID:      "u-1",
					namespace: types.NamespaceInfo{
						Value: "org-12",
						OrgID: 12,
					},
				},
			)
			require.Equal(t, allowed, gotAllowed)
			if referenceErr != nil {
				require.EqualError(t, gotErr, "could not evaluate legacy expression: "+referenceErr.Error())
			} else {
				require.NoError(t, gotErr)
			}
			require.Equal(t, tc.calls, calls)

			calls = nil
			got, err := s.LegacyCheck(legacyCheckContext(t), &authzextv1.LegacyCheckRequest{
				Namespace:           "org-12",
				Subject:             "user:u-1",
				Expression:          tc.expression,
				SkipScopeResolution: tc.skip,
			})
			require.NoError(t, err)
			want := &authzextv1.LegacyCheckResponse{Allowed: allowed}
			if referenceErr != nil {
				want.Error = "could not evaluate legacy expression: " + referenceErr.Error()
			}
			require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
			require.Equal(t, tc.calls, calls)
		})
	}
}

func TestLegacyCheckSharedWithMeEnablesResolversWithoutStoredGrants(t *testing.T) {
	ac := acimpl.ProvideAccessControlTest()
	ac.RegisterScopeAttributeResolver("dashboards:uid:", accesscontrol.ScopeAttributeResolverFunc(
		func(context.Context, int64, string) ([]string, error) {
			return nil, errors.New("resource lookup failed")
		},
	))
	s := NewTestService("u-1", nil, nil).
		WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
	s.store.(*fakeStore).basicRole = &store.BasicRole{Role: "Viewer"}
	s.identityStore.(*fakeIdentityStore).userTeams = []int64{10}
	s.actionResolver = legacyActionResolver{}
	permissions := &legacyPermissionStore{PermissionStore: s.permissionStore}
	s.permissionStore = permissions
	got, err := s.LegacyCheck(legacyCheckContext(t), legacyPermissionRequest("user:u-1", "dashboards:read", "dashboards:uid:one"))
	require.NoError(t, err)
	want := &authzextv1.LegacyCheckResponse{
		Allowed: false,
		Error:   "could not evaluate legacy expression: could not resolve dashboards:uid:one: resource lookup failed",
	}
	require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
	require.Equal(t, []store.PermissionsQuery{
		{
			UserID:     1,
			Role:       "Viewer",
			TeamIDs:    []int64{10},
			Action:     "dashboards:read",
			ActionSets: []string{"dashboards:view", "dashboards:edit"},
		},
	}, permissions.queries)
	require.Empty(t, permissions.presenceQueries)
}

func TestLegacyCheckResolversOverGRPC(t *testing.T) {
	ac := acimpl.ProvideAccessControlTest()
	ac.RegisterScopeAttributeResolver("dashboards:uid:", accesscontrol.ScopeAttributeResolverFunc(
		func(ctx context.Context, orgID int64, scope string) ([]string, error) {
			assert.Equal(t, int64(12), orgID)
			requester, err := identity.GetRequester(ctx)
			if !assert.NoError(t, err) {
				return nil, err
			}
			assert.Equal(t, &identity.StaticRequester{
				Type:           types.TypeUser,
				UserID:         1,
				UserUID:        "u-1",
				OrgID:          12,
				Namespace:      "org-12",
				IsGrafanaAdmin: false,
				CacheKey:       "org-12:user:u-1",
				Permissions: map[int64]map[string][]string{
					12: {
						"dashboards:read": {"folders:uid:parent"},
					},
				},
			}, requester)
			if scope == "dashboards:uid:missing" {
				return nil, errors.New("missing dashboard")
			}
			return []string{"folders:uid:parent"}, nil
		},
	))
	s := NewTestService("u-1", []accesscontrol.Permission{
		{
			Action: "dashboards:read",
			Scope:  "folders:uid:parent",
		},
	}, nil).WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
	listener := bufconn.Listen(1024 * 1024)
	authInfo, ok := types.AuthInfoFrom(legacyCheckContext(t))
	require.True(t, ok)
	server := grpc.NewServer(grpc.UnaryInterceptor(func(
		ctx context.Context,
		req any,
		_ *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (any, error) {
		return handler(types.WithAuthInfo(ctx, authInfo), req)
	}))
	authzextv1.RegisterLegacyAuthzServiceServer(server, s)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	t.Cleanup(func() { _ = listener.Close() })
	conn, err := grpc.NewClient(
		"passthrough:///legacy-check",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return listener.DialContext(ctx)
		}),
	)
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	client := authzextv1.NewLegacyAuthzServiceClient(conn)
	for _, tc := range []struct {
		name  string
		skip  bool
		scope string
		want  *authzextv1.LegacyCheckResponse
	}{
		{
			name:  "scope resolution",
			scope: "dashboards:uid:one",
			skip:  false,
			want:  &authzextv1.LegacyCheckResponse{Allowed: true},
		},
		{
			name:  "skip resolution",
			scope: "dashboards:uid:one",
			skip:  true,
			want:  &authzextv1.LegacyCheckResponse{Allowed: false},
		},
		{
			name:  "lookup error",
			scope: "dashboards:uid:missing",
			skip:  false,
			want: &authzextv1.LegacyCheckResponse{
				Allowed: false,
				Error:   "could not evaluate legacy expression: could not resolve dashboards:uid:missing: missing dashboard",
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			//nolint:staticcheck // Exercise the transitional compatibility RPC.
			got, err := client.LegacyCheck(t.Context(), &authzextv1.LegacyCheckRequest{
				Namespace:           "org-12",
				Subject:             "user:u-1",
				SkipScopeResolution: tc.skip,
				Expression:          legacyPermissionExpression("dashboards:read", tc.scope),
			})
			require.NoError(t, err)
			require.True(t, proto.Equal(tc.want, got), "want %v, got %v", tc.want, got)
		})
	}
}
