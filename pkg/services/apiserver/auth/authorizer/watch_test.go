package authorizer

import (
	"context"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/stretchr/testify/require"
	k8suser "k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestWatchRestriction(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagGrafanaRestrictWatchToServiceIdentities)
	for _, tc := range []struct {
		name     string
		identity types.AuthInfo
		user     k8suser.Info
		allowed  bool
	}{
		{name: "missing identity"},
		{name: "user", identity: &identity.StaticRequester{Type: types.TypeUser}},
		{name: "admin", identity: &identity.StaticRequester{Type: types.TypeUser, OrgRole: org.RoleAdmin, IsGrafanaAdmin: true}},
		{name: "anonymous", identity: &identity.StaticRequester{Type: types.TypeAnonymous}},
		{name: "api key", identity: &identity.StaticRequester{Type: types.TypeAPIKey}},
		{name: "service account", identity: &identity.StaticRequester{Type: types.TypeServiceAccount}, allowed: true},
		{name: "service identity", identity: &identity.StaticRequester{Type: types.TypeAccessPolicy}, allowed: true},
		{name: "loopback", user: &k8suser.DefaultInfo{Name: k8suser.APIServerUser, Groups: []string{k8suser.SystemPrivilegedGroup}}, allowed: true},
		{name: "loopback name without privileged group", user: &k8suser.DefaultInfo{Name: k8suser.APIServerUser}},
		{name: "delegated user", identity: authn.NewIDTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{}, &authn.Claims[authn.IDTokenClaims]{Rest: authn.IDTokenClaims{Type: types.TypeUser}})},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			if tc.identity != nil {
				ctx = types.WithAuthInfo(ctx, tc.identity)
			}
			for _, verb := range []string{"watch", "get", "list", "create", "update", "patch", "delete"} {
				t.Run(verb, func(t *testing.T) {
					called := false
					delegate := authorizer.AuthorizerFunc(func(context.Context, authorizer.Attributes) (authorizer.Decision, string, error) {
						called = true
						return authorizer.DecisionAllow, "", nil
					})
					attrs := authorizer.AttributesRecord{Verb: verb, ResourceRequest: true, User: tc.user}
					decision, reason, err := WithWatchRestriction(delegate).Authorize(ctx, attrs)
					require.NoError(t, err)
					if tc.allowed || verb != "watch" {
						require.Equal(t, authorizer.DecisionAllow, decision)
						require.True(t, called)
					} else {
						require.Equal(t, authorizer.DecisionDeny, decision)
						require.Contains(t, reason, "watch is restricted")
						require.False(t, called)
					}
				})
			}
		})
	}
}

func TestWatchRestrictionPreservesAuthorization(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagGrafanaRestrictWatchToServiceIdentities)
	ctx := types.WithAuthInfo(context.Background(), &identity.StaticRequester{Type: types.TypeServiceAccount})
	delegate := authorizer.AuthorizerFunc(func(context.Context, authorizer.Attributes) (authorizer.Decision, string, error) {
		return authorizer.DecisionDeny, "resource permission denied", nil
	})
	decision, reason, err := WithWatchRestriction(delegate).Authorize(ctx, authorizer.AttributesRecord{Verb: "watch", ResourceRequest: true})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "resource permission denied", reason)
}

func TestWatchRestrictionFlagChangesWithoutRestart(t *testing.T) {
	delegate := authorizer.AuthorizerFunc(func(context.Context, authorizer.Attributes) (authorizer.Decision, string, error) {
		return authorizer.DecisionAllow, "", nil
	})
	auth := WithWatchRestriction(delegate)
	for _, enabled := range []bool{false, true, false} {
		t.Run(map[bool]string{false: "disabled", true: "enabled"}[enabled], func(t *testing.T) {
			if enabled {
				featuremgmt.WithEnabledFlags(t, featuremgmt.FlagGrafanaRestrictWatchToServiceIdentities)
			} else {
				featuremgmt.WithDisabledFlags(t, featuremgmt.FlagGrafanaRestrictWatchToServiceIdentities)
			}
			decision, _, err := auth.Authorize(context.Background(), authorizer.AttributesRecord{Verb: "watch", ResourceRequest: true})
			require.NoError(t, err)
			want := authorizer.DecisionAllow
			if enabled {
				want = authorizer.DecisionDeny
			}
			require.Equal(t, want, decision)
		})
	}
}

func TestWatchRestrictionDefaultsOff(t *testing.T) {
	featuremgmt.WithEnabledFlags(t)
	delegate := authorizer.AuthorizerFunc(func(context.Context, authorizer.Attributes) (authorizer.Decision, string, error) {
		return authorizer.DecisionAllow, "", nil
	})
	decision, _, err := WithWatchRestriction(delegate).Authorize(context.Background(), authorizer.AttributesRecord{Verb: "watch", ResourceRequest: true})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionAllow, decision)
}
