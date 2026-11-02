package rbac

import (
	"context"
	"fmt"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/org"
)

func TestLegacyCheckBackgroundPermissions(t *testing.T) {
	grants := []accesscontrol.Permission{
		{Action: "folders:read", Scope: "folders:uid:allowed"},
		{Action: "alert.provisioning:write"},
	}

	for _, tc := range []struct {
		name      string
		evaluator accesscontrol.Evaluator
		empty     bool
		allowed   bool
	}{
		{name: "granted scope", evaluator: accesscontrol.EvalPermission("folders:read", "folders:uid:allowed"), allowed: true},
		{name: "different scope", evaluator: accesscontrol.EvalPermission("folders:read", "folders:uid:other")},
		{name: "scopeless grant", evaluator: accesscontrol.EvalPermission("alert.provisioning:write"), allowed: true},
		{name: "empty scope", evaluator: accesscontrol.EvalPermission("alert.provisioning:write", "")},
		{name: "action with no scopes", evaluator: accesscontrol.EvalPermission("action:without-scopes"), allowed: true},
		{name: "action with no scopes does not grant a resource", evaluator: accesscontrol.EvalPermission("action:without-scopes", "folders:uid:allowed")},
		{name: "admin role does not add grants", evaluator: accesscontrol.EvalPermission("dashboards:create")},
		{name: "empty all", evaluator: accesscontrol.EvalAll(), allowed: true},
		{name: "no grants", evaluator: accesscontrol.EvalPermission("folders:read"), empty: true},
		{name: "no grants empty all", evaluator: accesscontrol.EvalAll(), empty: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			permissions := grants
			if tc.empty {
				permissions = nil
			}

			requester := accesscontrol.BackgroundUser("provisioner", legacyInternalTestOrgID, org.RoleAdmin, permissions)
			if !tc.empty {
				requester.GetPermissions()["action:without-scopes"] = nil
			}

			ac := acimpl.ProvideAccessControlTest()
			service := NewTestService(legacyInternalTestUserUID, nil, nil).WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
			service.store, service.permissionStore = nil, nil
			client := newEmbeddedLegacyCheckTestClient(service)

			want, err := ac.Evaluate(t.Context(), requester, tc.evaluator)
			require.NoError(t, err)
			require.Equal(t, tc.allowed, want)

			allowed, err := client.LegacyCheck(t.Context(), backgroundLegacyRequest(requester.GetPermissions(), tc.evaluator))
			require.NoError(t, err)
			require.Equal(t, want, allowed)
		})
	}
}

func TestLegacyCheckBackgroundResolverPermissions(t *testing.T) {
	for _, withFolderRead := range []bool{false, true} {
		t.Run(fmt.Sprintf("folders_read=%t", withFolderRead), func(t *testing.T) {
			permissions := map[string][]string{"test:read": {"folders:uid:allowed"}}
			if withFolderRead {
				permissions["folders:read"] = []string{"folders:uid:allowed"}
			}

			ac := acimpl.ProvideAccessControlTest()
			calls := 0
			ac.RegisterScopeAttributeResolver("test:id:", accesscontrol.WithRequiredActions(accesscontrol.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, _ string) ([]string, error) {
				calls++

				requester, err := identity.GetRequester(ctx)
				require.NoError(t, err)

				require.Equal(t, legacyInternalTestOrgID, orgID)
				require.Equal(t, "grafana_provisioner", requester.GetLogin())
				require.Equal(t, org.RoleAdmin, requester.GetOrgRole())
				require.False(t, requester.GetIsGrafanaAdmin())
				require.Equal(t, permissions, requester.GetPermissions())

				_, ok := accesscontrol.BackgroundUserName(requester)
				require.True(t, ok, "nested authorization must recognize the reconstructed background user")

				if accesscontrol.EvalPermission("folders:read", "folders:uid:allowed").Evaluate(requester.GetPermissions()) {
					return []string{"folders:uid:allowed"}, nil
				}

				return []string{"test:id:denied"}, nil
			}), "folders:read"))

			service := NewTestService(legacyInternalTestUserUID, nil, nil).WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
			service.store, service.permissionStore = nil, nil
			client := newEmbeddedLegacyCheckTestClient(service)

			allowed, err := client.LegacyCheck(t.Context(), backgroundLegacyRequest(permissions, accesscontrol.EvalPermission("test:read", "test:id:target")))
			require.NoError(t, err)
			require.Equal(t, withFolderRead, allowed)
			require.Equal(t, 1, calls)
		})
	}
}

func TestLegacyCheckBackgroundValidation(t *testing.T) {
	service := NewTestService(legacyInternalTestUserUID, nil, nil).WithLegacyScopeResolvers(nil, types.OrgNamespaceFormatter)
	client := newEmbeddedLegacyCheckTestClient(service)

	for _, tc := range []struct {
		name   string
		modify func(*legacyclient.LegacyCheckRequest)
	}{
		{name: "predefined profile", modify: func(r *legacyclient.LegacyCheckRequest) {
			r.InternalIdentity.Profile = legacyclient.LegacyInternalIdentityService
		}},
		{name: "subject", modify: func(r *legacyclient.LegacyCheckRequest) { r.Subject = "user:someone" }},
		{name: "global evaluation", modify: func(r *legacyclient.LegacyCheckRequest) { r.GlobalEvaluation = &legacyclient.LegacyGlobalEvaluation{} }},
		{name: "action restriction", modify: func(r *legacyclient.LegacyCheckRequest) { r.Restriction = &legacyclient.LegacyActionRestriction{} }},
		{name: "wildcard namespace", modify: func(r *legacyclient.LegacyCheckRequest) { r.Namespace = "*" }},
		{name: "other instance", modify: func(r *legacyclient.LegacyCheckRequest) { r.Namespace = "stacks-123" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := backgroundLegacyRequest(map[string][]string{"folders:read": {"*"}}, accesscontrol.EvalPermission("folders:read"))
			tc.modify(&req)

			allowed, err := client.LegacyCheck(t.Context(), req)
			require.Error(t, err)
			require.False(t, allowed)
		})
	}

	t.Run("ordinary server rejects supplied grants", func(t *testing.T) {
		channel := &inprocgrpc.Channel{}
		authzv1.RegisterLegacyAuthzServiceServer(channel, service)
		client := legacyclient.NewLegacyClient(channel)

		allowed, err := client.LegacyCheck(t.Context(), backgroundLegacyRequest(map[string][]string{"folders:read": {"*"}}, accesscontrol.EvalPermission("folders:read")))
		require.ErrorContains(t, err, "require the embedded server")
		require.False(t, allowed)
	})
}

func backgroundLegacyRequest(permissions map[string][]string, evaluator accesscontrol.Evaluator) legacyclient.LegacyCheckRequest {
	return legacyclient.LegacyCheckRequest{
		Namespace: types.OrgNamespaceFormatter(legacyInternalTestOrgID),
		Evaluator: evaluator,
		InternalIdentity: &legacyclient.LegacyInternalIdentity{Background: &legacyclient.LegacyBackgroundIdentity{
			Name: "provisioner", OrgRole: string(org.RoleAdmin), Permissions: permissions,
		}},
	}
}
