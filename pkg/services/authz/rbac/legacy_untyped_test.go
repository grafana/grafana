package rbac

import (
	"context"
	"testing"
	"testing/synctest"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestLegacyCheckEmptyRestriction(t *testing.T) {
	for _, tc := range []struct {
		name        string
		subject     string
		restriction *authzextv1.LegacyActionRestriction
		namespace   string
		emptyAll    bool
		wantError   string
	}{
		{name: "untyped requester", subject: ":0", restriction: &authzextv1.LegacyActionRestriction{}},
		{name: "stored user", subject: "user:u-1", restriction: &authzextv1.LegacyActionRestriction{}},
		{name: "empty ALL remains denied", subject: ":0", restriction: &authzextv1.LegacyActionRestriction{}, emptyAll: true},
		{name: "missing restriction retains validation", subject: ":0", wantError: "got invalid type: auth.identity.invalid-typed-id"},
		{name: "nonempty restriction retains validation", subject: ":0",
			restriction: &authzextv1.LegacyActionRestriction{Actions: []string{"plugins.app:access"}},
			wantError:   "got invalid type: auth.identity.invalid-typed-id"},
		{name: "namespace isolation retains validation", subject: ":0", namespace: "org-13",
			restriction: &authzextv1.LegacyActionRestriction{}, wantError: "rpc error: code = PermissionDenied desc = namespace does not match"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service := NewTestService("u-1", nil, nil)
			service.store, service.permissionStore = nil, nil
			req := legacyPermissionRequest(tc.subject, "plugins.app:access", "plugins:id:test-app")
			req.Restriction = tc.restriction
			if tc.namespace != "" {
				req.Namespace = tc.namespace
			}
			if tc.emptyAll {
				req.Expression = legacyAllExpression()
			}

			got, err := service.LegacyCheck(legacyCheckContext(t), req)
			require.NoError(t, err)
			want := &authzextv1.LegacyCheckResponse{Allowed: false, Error: tc.wantError}
			require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
		})
	}
}

func TestLegacyCheckUntypedRequesterParity(t *testing.T) {
	for _, mode := range []struct {
		name    string
		primary bool
		shadow  bool
	}{
		{name: "local"},
		{name: "primary", primary: true},
		{name: "shadow", primary: true, shadow: true},
	} {
		t.Run(mode.name, func(t *testing.T) {
			featuremgmt.WithFlagValues(t, map[string]any{
				featuremgmt.FlagAuthzUseLegacyCheck:       mode.primary,
				featuremgmt.FlagAuthzUseLegacyCheckShadow: mode.shadow,
			})
			for _, tc := range []struct {
				name        string
				orgID       int64
				permissions map[int64]map[string][]string
			}{
				{name: "zero-value requester"},
				{name: "bootdata empty permissions", permissions: map[int64]map[string][]string{}},
				{name: "organization without permissions", orgID: 1},
				{name: "no organization without global permissions", orgID: accesscontrol.NoOrgID,
					permissions: map[int64]map[string][]string{1: {"plugins.app:access": {"plugins:*"}}}},
			} {
				t.Run(tc.name, func(t *testing.T) {
					requester := &user.SignedInUser{OrgID: tc.orgID, Permissions: tc.permissions}
					require.Equal(t, ":0", requester.GetUID())
					ac := acimpl.ProvideAccessControlTest()
					ac.RegisterScopeAttributeResolver("plugins:id:", accesscontrol.ScopeAttributeResolverFunc(
						func(context.Context, int64, string) ([]string, error) {
							t.Error("empty permissions must not invoke scope resolvers")
							return nil, nil
						},
					))
					service := NewTestService("u-1", nil, nil).WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
					service.store, service.permissionStore = nil, nil
					client := &untypedLegacyCheckClient{client: newEmbeddedLegacyCheckTestClient(service)}
					require.NoError(t, ac.SetLegacyCheckClient(client, types.OrgNamespaceFormatter, nil))

					synctest.Test(t, func(t *testing.T) {
						allowed, err := ac.Evaluate(t.Context(), requester, accesscontrol.EvalPermission("plugins.app:access", "plugins:id:test-app"))
						require.NoError(t, err)
						require.False(t, allowed)
						synctest.Wait()
						if mode.primary {
							require.Len(t, client.errors, 1)
							require.NoError(t, client.errors[0])
						} else {
							require.Empty(t, client.errors)
						}
					})
				})
			}
		})
	}
}

type untypedLegacyCheckClient struct {
	client legacyclient.LegacyAccessClient
	errors []error
}

func (c *untypedLegacyCheckClient) LegacyCheck(ctx context.Context, req legacyclient.LegacyCheckRequest) (bool, error) {
	allowed, err := c.client.LegacyCheck(ctx, req)
	c.errors = append(c.errors, err)
	return allowed, err
}
