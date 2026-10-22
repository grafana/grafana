package pluginroute

import (
	"context"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestGetAuthorizerManifestKinds(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions[1].Kinds = append(manifest.Versions[1].Kinds,
		app.ManifestVersionKind{Kind: "Secret", Plural: "Secrets", Scope: kindstore.ClusterScope},
		app.ManifestVersionKind{Kind: "Setting", Plural: "Settings", Scope: kindstore.ClusterScope, UserReadable: true},
	)
	manifest.Versions[1].OpenAPI.Paths["/secrets/{name}/rotate"] = spec3.PathProps{Post: &spec3.Operation{}}
	manifest.Versions[1].OpenAPI.Paths["/settings/{name}/reload"] = spec3.PathProps{Post: &spec3.Operation{}}

	b := &manifestBuilder{
		pluginID:      "test-app",
		kindPolicies:  kindPolicies(manifest),
		accessChecker: pluginaccesscontrol.NewAppAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: true}),
	}
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1})

	for _, tt := range []struct {
		name     string
		attr     authorizer.AttributesRecord
		decision authorizer.Decision
		reason   string
	}{
		{
			name:     "a namespaced kind is left to the storage layer",
			attr:     authorizer.AttributesRecord{Resource: "testkinds", Verb: "create"},
			decision: authorizer.DecisionAllow,
		},
		{
			name:     "the settings API is not a manifest kind",
			attr:     authorizer.AttributesRecord{Resource: "app", Verb: "update"},
			decision: authorizer.DecisionAllow,
		},
		{
			name:     "a cluster-scoped kind is unreadable unless the manifest says otherwise",
			attr:     authorizer.AttributesRecord{Resource: "secrets", Verb: "get"},
			decision: authorizer.DecisionDeny,
			reason:   "cluster-scoped resource not readable by users",
		},
		{
			name:     "a user-readable cluster-scoped kind can be read",
			attr:     authorizer.AttributesRecord{Resource: "settings", Verb: "list"},
			decision: authorizer.DecisionAllow,
		},
		{
			name:     "a user-readable cluster-scoped kind cannot be written",
			attr:     authorizer.AttributesRecord{Resource: "settings", Verb: "update"},
			decision: authorizer.DecisionDeny,
			reason:   "verb not permitted for cluster-scoped resource",
		},
		{
			name:     "a user-readable cluster-scoped kind cannot be watched",
			attr:     authorizer.AttributesRecord{Resource: "settings", Verb: "watch"},
			decision: authorizer.DecisionDeny,
			reason:   "verb not permitted for cluster-scoped resource",
		},
		{
			// The route is served by the plugin, not unified storage, so app
			// access is what authorizes it -- the read-only rule does not apply.
			name:     "a custom route on a cluster-scoped kind is reachable",
			attr:     authorizer.AttributesRecord{Resource: "settings", Subresource: "reload", Verb: "create"},
			decision: authorizer.DecisionAllow,
		},
		{
			name:     "a custom route is reachable on a kind users cannot read",
			attr:     authorizer.AttributesRecord{Resource: "secrets", Subresource: "rotate", Verb: "create"},
			decision: authorizer.DecisionAllow,
		},
		{
			name:     "a subresource the manifest does not declare is still refused",
			attr:     authorizer.AttributesRecord{Resource: "settings", Subresource: "scale", Verb: "update"},
			decision: authorizer.DecisionDeny,
			reason:   "verb not permitted for cluster-scoped resource",
		},
		{
			name:     "a user cannot update status",
			attr:     authorizer.AttributesRecord{Resource: "testkinds", Subresource: "status", Verb: "update"},
			decision: authorizer.DecisionDeny,
			reason:   "Users may not directly modify status",
		},
		{
			name:     "a user cannot patch status",
			attr:     authorizer.AttributesRecord{Resource: "testkinds", Subresource: "status", Verb: "patch"},
			decision: authorizer.DecisionDeny,
			reason:   "Users may not directly modify status",
		},
		{
			name:     "a user can read status",
			attr:     authorizer.AttributesRecord{Resource: "testkinds", Subresource: "status", Verb: "get"},
			decision: authorizer.DecisionAllow,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			decision, reason, err := b.GetAuthorizer().Authorize(ctx, tt.attr)
			require.NoError(t, err)
			require.Equal(t, tt.decision, decision)
			require.Equal(t, tt.reason, reason)
		})
	}
}

// The plugin's own app access still gates every request, so a caller who
// cannot reach the plugin never reaches its kinds either.
func TestGetAuthorizerAppAccessGatesKinds(t *testing.T) {
	b := &manifestBuilder{
		pluginID:      "test-app",
		kindPolicies:  kindPolicies(testManifest(t)),
		accessChecker: pluginaccesscontrol.NewAppAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: false}),
	}
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1})

	decision, reason, err := b.GetAuthorizer().Authorize(ctx,
		authorizer.AttributesRecord{Resource: "testkinds", Verb: "get"})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "access denied", reason)
}

// A plugin acting as itself has no scoped app access, so its token's
// permissions for the requested group stand in for it.
func TestGetAuthorizerServiceTokenPermissions(t *testing.T) {
	b := &manifestBuilder{
		pluginID:      "test-app",
		kindPolicies:  kindPolicies(testManifest(t)),
		accessChecker: pluginaccesscontrol.NewAppAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: false}),
	}
	service := func(permissions ...string) context.Context {
		return identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type: claims.TypeAccessPolicy, UserUID: "example-app", OrgID: 1,
			AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{Permissions: permissions}},
		})
	}
	authorize := func(ctx context.Context, group string) authorizer.Decision {
		decision, _, err := b.GetAuthorizer().Authorize(ctx, authorizer.AttributesRecord{APIGroup: group, Resource: "testkinds", Verb: "list"})
		require.NoError(t, err)
		return decision
	}

	require.Equal(t, authorizer.DecisionAllow, authorize(service("test.ext.grafana.app:*"), "test.ext.grafana.app"))
	// List needs get, as storage checks it.
	require.Equal(t, authorizer.DecisionAllow, authorize(service("test.ext.grafana.app/testkinds:get"), "test.ext.grafana.app"))
	require.Equal(t, authorizer.DecisionDeny, authorize(service("other.ext.grafana.app:*"), "test.ext.grafana.app"),
		"a token for another group needs app access for this one")
	require.Equal(t, authorizer.DecisionDeny, authorize(service("plugins.app:access"), "test.ext.grafana.app"),
		"without app access, an action name grants nothing")

	user := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1})
	require.Equal(t, authorizer.DecisionDeny, authorize(user, "test.ext.grafana.app"), "users still need app access")
}

func TestGetAuthorizerRequiresIdentity(t *testing.T) {
	b := &manifestBuilder{
		pluginID:      "test-app",
		kindPolicies:  kindPolicies(testManifest(t)),
		accessChecker: pluginaccesscontrol.NewAppAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: true}),
	}
	decision, reason, err := b.GetAuthorizer().Authorize(context.Background(),
		authorizer.AttributesRecord{Resource: "testkinds", Verb: "get"})
	require.Error(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "valid user is required", reason)
}

// Status is written by the services that reconcile it, never by users. An
// access policy writes it with update on the parent, since a grant cannot name
// a subresource.
func TestGetAuthorizerStatusOnlyWritableByServices(t *testing.T) {
	b := &manifestBuilder{
		pluginID:      "test-app",
		kindPolicies:  kindPolicies(testManifest(t)),
		accessChecker: pluginaccesscontrol.NewAppAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: true}),
	}
	status := func(verb string) authorizer.AttributesRecord {
		return authorizer.AttributesRecord{APIGroup: testGroup, Resource: "testkinds", Subresource: "status", Verb: verb}
	}

	for _, service := range []*identity.StaticRequester{
		{Type: claims.TypeServiceAccount, UserUID: "svc", OrgID: 1},
		accessPolicy(testGroup + "/testkinds:update"),
	} {
		for _, verb := range []string{"update", "patch"} {
			decision, reason := authorize(t, b, service, status(verb))
			require.Equal(t, authorizer.DecisionAllow, decision, "%s %s: %s", service.Type, verb, reason)
		}
	}

	decision, reason := authorize(t, b, accessPolicy(testGroup+"/testkinds/status:update"), status("update"))
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "access policy does not grant example.ext.grafana.app/testkinds:update", reason)
}

// Storage is called with a token this server substitutes or exchanges, so an
// access policy is held to its own token's permissions, by the verb storage
// checks, for a kind of either scope.
func TestGetAuthorizerAccessPolicyVerbs(t *testing.T) {
	b := builderWithClusterKind(t)
	for _, resource := range []string{"testkinds", "secrets"} {
		readUpdate := accessPolicy(testGroup+"/"+resource+":get", testGroup+"/"+resource+":update")
		for verb, want := range map[string]authorizer.Decision{
			"get":              authorizer.DecisionAllow,
			"list":             authorizer.DecisionAllow,
			"watch":            authorizer.DecisionAllow,
			"update":           authorizer.DecisionAllow,
			"patch":            authorizer.DecisionAllow,
			"create":           authorizer.DecisionDeny,
			"delete":           authorizer.DecisionDeny,
			"deletecollection": authorizer.DecisionDeny,
		} {
			decision, reason := authorize(t, b, readUpdate, authorizer.AttributesRecord{APIGroup: testGroup, Resource: resource, Verb: verb})
			require.Equal(t, want, decision, "%s %s: %s", verb, resource, reason)
		}
	}
}

// A verb no permission is named with is refused, even under a wildcard grant.
func TestGetAuthorizerAccessPolicyUnknownVerb(t *testing.T) {
	decision, reason := authorize(t, builderWithClusterKind(t), accessPolicy(testGroup+"/testkinds:*"),
		authorizer.AttributesRecord{APIGroup: testGroup, Resource: "testkinds", Verb: "proxy"})
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, `verb "proxy" cannot be granted to an access policy`, reason)
}

// Search, trash and list-keys are posted, so Kubernetes parses them as a
// create, but they only read.
func TestGetAuthorizerAccessPolicySearchIsARead(t *testing.T) {
	b := builderWithClusterKind(t)
	for _, endpoint := range []string{searchv0.SearchPathSegment, searchv0.TrashPathSegment, utils.ListKeysPathSegment} {
		attr := authorizer.AttributesRecord{
			ResourceRequest: true, Verb: "create",
			APIGroup: testGroup, Namespace: "default", Resource: "testkinds", Name: endpoint,
		}
		decision, reason := authorize(t, b, accessPolicy(testGroup+"/testkinds:get"), attr)
		require.Equal(t, authorizer.DecisionAllow, decision, "%s: %s", endpoint, reason)

		decision, _ = authorize(t, b, accessPolicy(), attr)
		require.Equal(t, authorizer.DecisionDeny, decision, endpoint)
	}
}

// A custom route never reaches storage, so the route's own declared check
// decides, not the token's permissions on the kind.
func TestGetAuthorizerAccessPolicyCustomRoutes(t *testing.T) {
	b := builderWithClusterKind(t)
	for resource, route := range map[string]string{"testkinds": "reload", "secrets": "rotate"} {
		decision, reason := authorize(t, b, accessPolicy(), authorizer.AttributesRecord{
			APIGroup: testGroup, Resource: resource, Subresource: route, Verb: "create",
		})
		require.Equal(t, authorizer.DecisionAllow, decision, "%s/%s: %s", resource, route, reason)
	}
}

const testGroup = "example.ext.grafana.app"

// builderWithClusterKind serves the test manifest plus Secrets, a
// cluster-scoped kind with a rotate route.
func builderWithClusterKind(t *testing.T) *manifestBuilder {
	t.Helper()
	manifest := testManifest(t)
	manifest.Versions[1].Kinds = append(manifest.Versions[1].Kinds,
		app.ManifestVersionKind{Kind: "Secret", Plural: "Secrets", Scope: kindstore.ClusterScope})
	manifest.Versions[1].OpenAPI.Paths["/secrets/{name}/rotate"] = spec3.PathProps{Post: &spec3.Operation{}}
	return &manifestBuilder{
		pluginID:      "test-app",
		kindPolicies:  kindPolicies(manifest),
		accessChecker: pluginaccesscontrol.NewAppAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: true}),
	}
}

// accessPolicy is a service caller whose access token grants permissions.
func accessPolicy(permissions ...string) *identity.StaticRequester {
	return &identity.StaticRequester{
		Type: claims.TypeAccessPolicy, UserUID: "svc", OrgID: 1,
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{Permissions: permissions},
		},
	}
}

func authorize(t *testing.T, b *manifestBuilder, caller identity.Requester, attr authorizer.Attributes) (authorizer.Decision, string) {
	t.Helper()
	decision, reason, err := b.GetAuthorizer().Authorize(identity.WithRequester(context.Background(), caller), attr)
	require.NoError(t, err)
	return decision, reason
}

// kindstore.New refuses a kind without a plural, so it has no resource to
// police.
func TestKindPoliciesSkipKindsWithoutPlural(t *testing.T) {
	require.Nil(t, kindPolicies(nil))
	policies := kindPolicies(&app.ManifestData{Versions: []app.ManifestVersion{{
		Name: "v1", Served: true,
		Kinds: []app.ManifestVersionKind{{Kind: "NoPlural", Scope: kindstore.ClusterScope}},
	}}})
	require.Empty(t, policies)
}

// A kind route's subresource starts with a literal segment, which is what the
// authorizer is given for a request below it, so a route with parameters
// further down is still recognised.
func TestGetAuthorizerParameterizedCustomRoute(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions[1].Kinds = append(manifest.Versions[1].Kinds,
		app.ManifestVersionKind{Kind: "Secret", Plural: "Secrets", Scope: kindstore.ClusterScope})
	manifest.Versions[1].OpenAPI.Paths["/secrets/{name}/rotate/{key}"] = spec3.PathProps{Post: &spec3.Operation{}}
	b := &manifestBuilder{
		pluginID:      "test-app",
		kindPolicies:  kindPolicies(manifest),
		accessChecker: pluginaccesscontrol.NewAppAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: true}),
	}
	require.Equal(t, map[string]bool{"rotate": true}, b.kindPolicies["secrets"].customRoutes)

	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1})
	decision, reason, err := b.GetAuthorizer().Authorize(ctx,
		authorizer.AttributesRecord{Resource: "secrets", Subresource: "rotate", Verb: "create"})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionAllow, decision, reason)
}
