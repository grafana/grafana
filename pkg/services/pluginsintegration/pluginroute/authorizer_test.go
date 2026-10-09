package pluginroute

import (
	"context"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
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
		accessChecker: appplugin.NewPluginAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: true}),
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
			attr:     authorizer.AttributesRecord{Resource: "settings", Subresource: "status", Verb: "update"},
			decision: authorizer.DecisionDeny,
			reason:   "verb not permitted for cluster-scoped resource",
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
		accessChecker: appplugin.NewPluginAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: false}),
	}
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1})

	decision, reason, err := b.GetAuthorizer().Authorize(ctx,
		authorizer.AttributesRecord{Resource: "testkinds", Verb: "get"})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "access denied", reason)
}

func TestGetAuthorizerRequiresIdentity(t *testing.T) {
	b := &manifestBuilder{
		pluginID:      "test-app",
		kindPolicies:  kindPolicies(testManifest(t)),
		accessChecker: appplugin.NewPluginAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: true}),
	}
	decision, reason, err := b.GetAuthorizer().Authorize(context.Background(),
		authorizer.AttributesRecord{Resource: "testkinds", Verb: "get"})
	require.Error(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "valid user is required", reason)
}

// Service identities operate cluster-scoped kinds that users cannot read; their
// access was already decided by the plugin's app access.
func TestGetAuthorizerServiceIdentityOnClusterKind(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions[1].Kinds = append(manifest.Versions[1].Kinds,
		app.ManifestVersionKind{Kind: "Secret", Plural: "Secrets", Scope: kindstore.ClusterScope})
	b := &manifestBuilder{
		pluginID:      "test-app",
		kindPolicies:  kindPolicies(manifest),
		accessChecker: appplugin.NewPluginAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: true}),
	}
	attr := authorizer.AttributesRecord{Resource: "secrets", Verb: "update"}

	user := identity.WithRequester(context.Background(), &identity.StaticRequester{Type: claims.TypeUser, UserID: 1, OrgID: 1})
	decision, _, err := b.GetAuthorizer().Authorize(user, attr)
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision, "a user cannot write the kind")

	service := identity.WithRequester(context.Background(), &identity.StaticRequester{Type: claims.TypeAccessPolicy, UserUID: "svc", OrgID: 1})
	decision, reason, err := b.GetAuthorizer().Authorize(service, attr)
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionAllow, decision, reason)
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
