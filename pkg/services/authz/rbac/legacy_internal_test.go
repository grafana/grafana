package rbac

import (
	"context"
	"fmt"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

const (
	legacyInternalTestOrgID   int64 = 12
	legacyInternalTestUserUID       = "u-1"
)

func TestLegacyCheckInternalProfiles(t *testing.T) {
	tests := []struct {
		name        string
		evaluator   accesscontrol.Evaluator
		wantAllowed bool
	}{
		{
			name:        "create provisioned dashboard",
			evaluator:   accesscontrol.EvalPermission("dashboards:create", "folders:uid:target"),
			wantAllowed: true,
		},
		{
			name:        "read nonexistent panel without lookup",
			evaluator:   accesscontrol.EvalPermission("library.panels:read", "library.panels:uid:missing"),
			wantAllowed: true,
		},
		{
			name:        "action only",
			evaluator:   accesscontrol.EvalPermission("dashboards:write"),
			wantAllowed: true,
		},
		{
			name:      "ungranted action",
			evaluator: accesscontrol.EvalPermission("users:delete"),
		},
		{
			name: "all retains denied action",
			evaluator: accesscontrol.EvalAll(
				accesscontrol.EvalPermission("dashboards:create"),
				accesscontrol.EvalPermission("users:delete"),
			),
		},
		{
			name: "any allows granted action",
			evaluator: accesscontrol.EvalAny(
				accesscontrol.EvalPermission("users:delete"),
				accesscontrol.EvalPermission("dashboards:create"),
			),
			wantAllowed: true,
		},
		{
			name:        "empty all with nonempty grants",
			evaluator:   accesscontrol.EvalAll(),
			wantAllowed: true,
		},
		{
			name:      "empty any",
			evaluator: accesscontrol.EvalAny(),
		},
	}

	for _, profile := range []legacyclient.LegacyInternalIdentityProfile{legacyclient.LegacyInternalIdentityService, legacyclient.LegacyInternalIdentityProvisioning} {
		t.Run(profile.String(), func(t *testing.T) {
			ac := acimpl.ProvideAccessControlTest()
			registry := acimpl.ProvideScopeResolverRegistry(ac)
			service := NewTestService(legacyInternalTestUserUID, nil, nil).WithLegacyScopeResolvers(registry, types.OrgNamespaceFormatter)

			// Internal checks must not read user, role, or permission stores.
			service.store, service.permissionStore = nil, nil
			client := newEmbeddedLegacyCheckTestClient(service)

			for _, tc := range tests {
				t.Run(tc.name, func(t *testing.T) {
					for _, skipScopeResolution := range []bool{false, true} {
						t.Run(fmt.Sprintf("skip_scope_resolution=%t", skipScopeResolution), func(t *testing.T) {
							req := internalLegacyRequest(profile, tc.evaluator)
							req.SkipScopeResolution = skipScopeResolution

							allowed, err := client.LegacyCheck(t.Context(), req)
							require.NoError(t, err)
							require.Equal(t, tc.wantAllowed, allowed)
						})
					}
				})
			}
		})
	}
}

func TestLegacyCheckInternalIdentityValidation(t *testing.T) {
	service := NewTestService(legacyInternalTestUserUID, nil, nil).WithLegacyScopeResolvers(nil, types.OrgNamespaceFormatter)
	client := newEmbeddedLegacyCheckTestClient(service)

	tests := []struct {
		name   string
		modify func(*legacyclient.LegacyCheckRequest)
	}{
		{
			name: "unknown profile",
			modify: func(r *legacyclient.LegacyCheckRequest) {
				r.InternalIdentity.Profile = "unknown"
			},
		},
		{
			name: "empty profile",
			modify: func(r *legacyclient.LegacyCheckRequest) {
				r.InternalIdentity.Profile = ""
			},
		},
		{
			name: "ambiguous subject",
			modify: func(r *legacyclient.LegacyCheckRequest) {
				r.Subject = types.NewTypeID(types.TypeUser, legacyInternalTestUserUID)
			},
		},
		{
			name: "global user evaluation",
			modify: func(r *legacyclient.LegacyCheckRequest) {
				r.GlobalEvaluation = &legacyclient.LegacyGlobalEvaluation{}
			},
		},
		{
			name: "wildcard target",
			modify: func(r *legacyclient.LegacyCheckRequest) {
				r.Namespace = "*"
			},
		},
		{
			name: "missing target",
			modify: func(r *legacyclient.LegacyCheckRequest) {
				r.Namespace = ""
			},
		},
		{
			name: "unconfigured stack",
			modify: func(r *legacyclient.LegacyCheckRequest) {
				r.Namespace = "stacks-123"
			},
		},
		{
			name: "plain access policy",
			modify: func(r *legacyclient.LegacyCheckRequest) {
				r.InternalIdentity = nil
				r.Subject = types.NewTypeID(types.TypeAccessPolicy, identity.InternalIdentityService.String())
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := internalLegacyRequest(legacyclient.LegacyInternalIdentityService, accesscontrol.EvalPermission("dashboards:create"))
			tc.modify(&req)

			allowed, err := client.LegacyCheck(t.Context(), req)
			require.Error(t, err)
			require.False(t, allowed)
		})
	}
}

func TestLegacyCheckInternalIdentityRequiresEmbeddedServer(t *testing.T) {
	tests := []struct {
		name     string
		embedded bool
	}{
		{name: "ordinary server rejects internal profiles"},
		{name: "embedded server accepts internal profiles", embedded: true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			service := NewTestService(legacyInternalTestUserUID, nil, nil).WithLegacyScopeResolvers(nil, types.OrgNamespaceFormatter)
			channel := (&inprocgrpc.Channel{}).WithServerUnaryInterceptor(func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
				_, caller := identity.WithServiceIdentity(ctx, legacyInternalTestOrgID)

				return handler(types.WithAuthInfo(ctx, caller), req)
			})
			if tc.embedded {
				RegisterEmbeddedLegacyCheckServer(channel, service)
			} else {
				authzv1.RegisterLegacyAuthzServiceServer(channel, service)
			}

			client := legacyclient.NewLegacyClient(channel)
			req := internalLegacyRequest(legacyclient.LegacyInternalIdentityService, accesscontrol.EvalPermission("dashboards:create"))

			allowed, err := client.LegacyCheck(t.Context(), req)
			if tc.embedded {
				require.NoError(t, err)
				require.True(t, allowed)
			} else {
				require.ErrorContains(t, err, "require the embedded server")
				require.False(t, allowed)
			}
		})
	}
}

func TestLegacyCheckInternalClientPreservesUserGrants(t *testing.T) {
	service := NewTestService(legacyInternalTestUserUID, nil, nil).WithLegacyScopeResolvers(nil, types.OrgNamespaceFormatter)
	client := newEmbeddedLegacyCheckTestClient(service)
	subject := types.NewTypeID(types.TypeUser, legacyInternalTestUserUID)

	allowed, err := client.LegacyCheck(t.Context(), legacyclient.LegacyCheckRequest{
		Namespace: types.OrgNamespaceFormatter(legacyInternalTestOrgID),
		Subject:   subject,
		Evaluator: accesscontrol.EvalPermission("dashboards:create"),
	})
	require.NoError(t, err)
	require.False(t, allowed)
}

func TestLegacyCheckInternalResolverRequester(t *testing.T) {
	const targetUserID = 42

	tests := []struct {
		name              string
		action            string
		requiredActions   []string
		wantAllowed       bool
		wantResolverCalls int
	}{
		{
			name:              "denied action resolves as the internal requester",
			action:            "users:delete",
			wantResolverCalls: 1,
		},
		{
			name:              "resolver uses existing profile dependency grants",
			action:            "users:delete",
			requiredActions:   []string{"folders:read"},
			wantResolverCalls: 1,
		},
		{
			name:              "missing profile dependency does not load user permissions",
			action:            "users:delete",
			requiredActions:   []string{"users:delete"},
			wantResolverCalls: 1,
		},
		{
			name:        "wildcard grant avoids resource lookups",
			action:      "users:read",
			wantAllowed: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ac := acimpl.ProvideAccessControlTest()
			calls := 0
			ac.RegisterScopeAttributeResolver("users:id:", accesscontrol.WithRequiredActions(accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
				calls++

				requester, err := identity.GetRequester(ctx)
				require.NoError(t, err)
				require.Equal(t, legacyInternalTestOrgID, orgID)
				require.Equal(t, types.OrgNamespaceFormatter(legacyInternalTestOrgID), requester.GetNamespace())

				profile, ok := identity.InternalIdentityProfileFor(requester)
				require.True(t, ok)
				require.Equal(t, identity.InternalIdentityService, profile)
				require.Equal(t, []string{"*"}, requester.GetPermissions()["folders:read"])
				require.NotContains(t, requester.GetPermissions(), "users:delete")

				return []string{"users:uid:target"}, nil
			}), tc.requiredActions...))

			registry := acimpl.ProvideScopeResolverRegistry(ac)
			service := NewTestService(legacyInternalTestUserUID, nil, nil).WithLegacyScopeResolvers(registry, types.OrgNamespaceFormatter)
			service.store, service.permissionStore = nil, nil
			client := newEmbeddedLegacyCheckTestClient(service)
			evaluator := accesscontrol.EvalPermission(tc.action, fmt.Sprintf("users:id:%d", targetUserID))
			req := internalLegacyRequest(legacyclient.LegacyInternalIdentityService, evaluator)

			allowed, err := client.LegacyCheck(t.Context(), req)
			require.NoError(t, err)
			require.Equal(t, tc.wantAllowed, allowed)
			require.Equal(t, tc.wantResolverCalls, calls)
		})
	}
}

func newEmbeddedLegacyCheckTestClient(service *Service) *legacyclient.LegacyClient {
	channel := (&inprocgrpc.Channel{}).WithServerUnaryInterceptor(func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		ctx = types.WithAuthInfo(ctx, authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{Namespace: "*"},
		}))

		return handler(ctx, req)
	})
	RegisterEmbeddedLegacyCheckServer(channel, service)

	return legacyclient.NewLegacyClient(channel, legacyclient.WithLegacyTracerClientOption(service.tracer))
}

func internalLegacyRequest(profile legacyclient.LegacyInternalIdentityProfile, evaluator accesscontrol.Evaluator) legacyclient.LegacyCheckRequest {
	return legacyclient.LegacyCheckRequest{
		Namespace:        types.OrgNamespaceFormatter(legacyInternalTestOrgID),
		InternalIdentity: &legacyclient.LegacyInternalIdentity{Profile: profile},
		Evaluator:        evaluator,
	}
}
