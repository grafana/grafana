package pluginroute

import (
	"context"
	"testing"

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
		app.ManifestVersionKind{Kind: "Secret", Plural: "Secrets", Scope: kindstore.ClusterScope,
			Routes: map[string]spec3.PathProps{"/rotate": {Post: &spec3.Operation{}}}},
		app.ManifestVersionKind{Kind: "Setting", Plural: "Settings", Scope: kindstore.ClusterScope, UserReadable: true,
			Routes: map[string]spec3.PathProps{"/reload": {Post: &spec3.Operation{}}}},
	)

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
