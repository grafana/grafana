package dashboard

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func searchAttributes(name, verb string) authorizer.Attributes {
	return authorizer.AttributesRecord{
		ResourceRequest: true,
		APIGroup:        dashv0.GROUP,
		APIVersion:      dashv0.VERSION,
		Resource:        "search",
		Name:            name,
		Verb:            verb,
		Namespace:       "stacks-1",
	}
}

func delegatedRequester(delegated ...string) *identity.StaticRequester {
	return &identity.StaticRequester{
		OrgID: 1,
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{DelegatedPermissions: delegated},
		},
	}
}

func serviceRequester(permissions ...string) *identity.StaticRequester {
	return &identity.StaticRequester{
		OrgID: 1,
		Type:  authlib.TypeAccessPolicy,
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{Permissions: permissions},
		},
	}
}

func TestDashboardsAPIBuilderSearchAuthorizer(t *testing.T) {
	authz := (&DashboardsAPIBuilder{}).GetAuthorizer()

	cases := []struct {
		name      string
		requester identity.Requester
		want      authorizer.Decision
	}{
		{
			name:      "delegated dashboards and folders get",
			requester: delegatedRequester("dashboard.grafana.app/dashboards:get", "folder.grafana.app/folders:get"),
			want:      authorizer.DecisionAllow,
		},
		{
			name:      "delegated dashboards and folders list",
			requester: delegatedRequester("dashboard.grafana.app/dashboards:list", "folder.grafana.app/folders:list"),
			want:      authorizer.DecisionAllow,
		},
		{
			name:      "delegated resource wildcards",
			requester: delegatedRequester("dashboard.grafana.app/dashboards:*", "folder.grafana.app/folders:*"),
			want:      authorizer.DecisionAllow,
		},
		{
			name:      "delegated group wildcards",
			requester: delegatedRequester("dashboard.grafana.app:*", "folder.grafana.app:*"),
			want:      authorizer.DecisionAllow,
		},
		{
			name:      "delegated dashboards and folders plus legacy search grant",
			requester: delegatedRequester("dashboard.grafana.app/dashboards:get", "folder.grafana.app/folders:get", "dashboard.grafana.app/search:*"),
			want:      authorizer.DecisionAllow,
		},
		{
			name:      "delegated without dashboards read",
			requester: delegatedRequester("folder.grafana.app/folders:get"),
			want:      authorizer.DecisionDeny,
		},
		{
			name:      "delegated without folders read",
			requester: delegatedRequester("dashboard.grafana.app/dashboards:get"),
			want:      authorizer.DecisionDeny,
		},
		{
			name:      "delegated dashboards group wildcard without folders",
			requester: delegatedRequester("dashboard.grafana.app:*"),
			want:      authorizer.DecisionDeny,
		},
		{
			name:      "delegated search grant only",
			requester: delegatedRequester("dashboard.grafana.app/search:*"),
			want:      authorizer.DecisionDeny,
		},
		{
			name:      "service token with dashboards and folders read",
			requester: serviceRequester("dashboard.grafana.app/dashboards:get", "folder.grafana.app/folders:get"),
			want:      authorizer.DecisionAllow,
		},
		{
			name:      "service token with search grant only",
			requester: serviceRequester("dashboard.grafana.app/search:*"),
			want:      authorizer.DecisionDeny,
		},
	}

	// The sortable, vector and hybrid routes are GETs on the same namespace
	// search resource and carry the same exposure, so they share the rule.
	routes := []struct{ name, verb string }{
		{"", "list"},
		{"", "get"},
		{"sortable", "get"},
		{"vector", "get"},
		{"hybrid", "get"},
	}

	for _, route := range routes {
		for _, tc := range cases {
			t.Run(route.verb+"/"+route.name+"/"+tc.name, func(t *testing.T) {
				ctx := identity.WithRequester(context.Background(), tc.requester)
				decision, _, err := authz.Authorize(ctx, searchAttributes(route.name, route.verb))
				require.NoError(t, err)
				require.Equal(t, tc.want, decision)
			})
		}
	}

	t.Run("the rule applies to every API version", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(),
			delegatedRequester("dashboard.grafana.app/dashboards:get", "folder.grafana.app/folders:get"))
		for _, version := range []string{"v0alpha1", "v1", "v2beta1"} {
			attr := searchAttributes("", "list").(authorizer.AttributesRecord)
			attr.APIVersion = version
			decision, _, err := authz.Authorize(ctx, attr)
			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionAllow, decision, version)
		}
	})

	t.Run("built-in service identity is allowed", func(t *testing.T) {
		ctx := identity.WithServiceIdentityContext(context.Background(), 1)
		decision, _, err := authz.Authorize(ctx, searchAttributes("", "list"))
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("no identity is rejected", func(t *testing.T) {
		decision, _, err := authz.Authorize(context.Background(), searchAttributes("", "list"))
		require.ErrorContains(t, err, "no identity found")
		require.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("search requests that are not the namespace search keep the service check", func(t *testing.T) {
		// A subresource, an unknown name or a write verb must still need a
		// grant on the search resource itself.
		onlyDashboardsAndFolders := identity.WithRequester(context.Background(),
			delegatedRequester("dashboard.grafana.app/dashboards:*", "folder.grafana.app/folders:*"))
		withSearch := identity.WithRequester(context.Background(),
			delegatedRequester("dashboard.grafana.app/search:*"))

		other := make([]authorizer.Attributes, 0, 8)
		other = append(other,
			authorizer.AttributesRecord{ResourceRequest: true, APIGroup: dashv0.GROUP, Resource: "search", Name: "other", Verb: "get"},
			authorizer.AttributesRecord{ResourceRequest: true, APIGroup: dashv0.GROUP, Resource: "search", Subresource: "x", Verb: "get"},
		)
		for _, verb := range []string{"create", "update", "patch", "delete", "deletecollection", "watch"} {
			other = append(other, authorizer.AttributesRecord{ResourceRequest: true, APIGroup: dashv0.GROUP, Resource: "search", Verb: verb})
		}
		for _, attr := range other {
			decision, _, err := authz.Authorize(onlyDashboardsAndFolders, attr)
			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionDeny, decision)

			decision, _, err = authz.Authorize(withSearch, attr)
			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionAllow, decision)
		}
	})

	t.Run("dashboards requests still use the service check", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), delegatedRequester("dashboard.grafana.app/dashboards:get"))
		decision, _, err := authz.Authorize(ctx, authzAttributes(dashv0.DashboardResourceInfo.GetName(), "get"))
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, decision)

		ctx = identity.WithRequester(context.Background(), delegatedRequester("folder.grafana.app/folders:get"))
		decision, _, err = authz.Authorize(ctx, authzAttributes(dashv0.DashboardResourceInfo.GetName(), "get"))
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
	})
}

// recordingAuthorizer returns scripted decisions and records the attributes it
// was asked about.
type recordingAuthorizer struct {
	decisions []authorizer.Decision
	err       error
	errAt     int // index of the check that returns err
	asked     []authorizer.Attributes
}

func (r *recordingAuthorizer) authorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(r.authorize)
}

func (r *recordingAuthorizer) authorize(_ context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	i := len(r.asked)
	r.asked = append(r.asked, attr)
	if r.err != nil && i == r.errAt {
		return authorizer.DecisionDeny, "", r.err
	}
	return r.decisions[i], "reason", nil
}

func TestNewSearchAuthorizer(t *testing.T) {
	t.Run("asks for list on dashboards and folders", func(t *testing.T) {
		fake := &recordingAuthorizer{decisions: []authorizer.Decision{authorizer.DecisionAllow, authorizer.DecisionAllow}}
		decision, _, err := newSearchAuthorizer(fake.authorizer()).Authorize(context.Background(), searchAttributes("", "list"))
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, decision)
		require.Len(t, fake.asked, 2)

		type check struct{ group, resource, verb, namespace string }
		got := make([]check, 0, len(fake.asked))
		for _, a := range fake.asked {
			require.True(t, a.IsResourceRequest())
			got = append(got, check{a.GetAPIGroup(), a.GetResource(), a.GetVerb(), a.GetNamespace()})
		}
		require.Equal(t, []check{
			{"dashboard.grafana.app", "dashboards", "list", "stacks-1"},
			{"folder.grafana.app", "folders", "list", "stacks-1"},
		}, got)
	})

	t.Run("stops at the first denial and returns its decision", func(t *testing.T) {
		fake := &recordingAuthorizer{decisions: []authorizer.Decision{authorizer.DecisionDeny}}
		decision, reason, err := newSearchAuthorizer(fake.authorizer()).Authorize(context.Background(), searchAttributes("", "list"))
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.Equal(t, "reason", reason)
		require.Len(t, fake.asked, 1)
	})

	t.Run("no opinion from a check is denied", func(t *testing.T) {
		for i := range 2 {
			decisions := []authorizer.Decision{authorizer.DecisionAllow, authorizer.DecisionAllow}
			decisions[i] = authorizer.DecisionNoOpinion
			fake := &recordingAuthorizer{decisions: decisions}
			decision, _, err := newSearchAuthorizer(fake.authorizer()).Authorize(context.Background(), searchAttributes("", "list"))
			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionDeny, decision)
		}
	})

	t.Run("an error from a check is returned and denies", func(t *testing.T) {
		boom := errors.New("boom")
		fake := &recordingAuthorizer{err: boom}
		decision, _, err := newSearchAuthorizer(fake.authorizer()).Authorize(context.Background(), searchAttributes("", "list"))
		require.ErrorIs(t, err, boom)
		require.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("a denial from the folders check is returned", func(t *testing.T) {
		fake := &recordingAuthorizer{decisions: []authorizer.Decision{authorizer.DecisionAllow, authorizer.DecisionDeny}}
		decision, reason, err := newSearchAuthorizer(fake.authorizer()).Authorize(context.Background(), searchAttributes("", "list"))
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.Equal(t, "reason", reason)
		require.Len(t, fake.asked, 2)
	})

	t.Run("an error from the folders check is returned and denies", func(t *testing.T) {
		boom := errors.New("boom")
		fake := &recordingAuthorizer{decisions: []authorizer.Decision{authorizer.DecisionAllow}, err: boom, errAt: 1}
		decision, _, err := newSearchAuthorizer(fake.authorizer()).Authorize(context.Background(), searchAttributes("", "list"))
		require.ErrorIs(t, err, boom)
		require.Equal(t, authorizer.DecisionDeny, decision)
		require.Len(t, fake.asked, 2)
	})

	t.Run("other requests go straight to the fallback", func(t *testing.T) {
		fake := &recordingAuthorizer{decisions: []authorizer.Decision{authorizer.DecisionAllow}}
		attr := authzAttributes("dashboards", "get")
		_, _, err := newSearchAuthorizer(fake.authorizer()).Authorize(context.Background(), attr)
		require.NoError(t, err)
		require.Equal(t, []authorizer.Attributes{attr}, fake.asked)
	})
}
