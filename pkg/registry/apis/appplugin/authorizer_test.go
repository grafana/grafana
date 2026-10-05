package appplugin

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/kindstore"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestGetAuthorizer(t *testing.T) {
	tests := []struct {
		name             string
		ctx              context.Context
		expectedDecision authorizer.Decision
		expectedReason   string
		expectedErr      bool
		fakeAC           actest.FakeAccessControl
	}{
		{
			name:             "denies without a requester",
			ctx:              context.Background(),
			fakeAC:           actest.FakeAccessControl{ExpectedEvaluate: true},
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "valid user is required",
			expectedErr:      true,
		},
		{
			name:             "denies when access control evaluation fails",
			ctx:              identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1}),
			fakeAC:           actest.FakeAccessControl{ExpectedEvaluate: false, ExpectedErr: fmt.Errorf("eval error")},
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "authorization check failed",
			expectedErr:      true,
		},
		{
			name:             "denies when user lacks permission",
			ctx:              identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1}),
			fakeAC:           actest.FakeAccessControl{ExpectedEvaluate: false},
			expectedDecision: authorizer.DecisionDeny,
			expectedReason:   "access denied",
			expectedErr:      false,
		},
		{
			name:             "checks request type when user has permission",
			ctx:              identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1}),
			fakeAC:           actest.FakeAccessControl{ExpectedEvaluate: true},
			expectedDecision: authorizer.DecisionAllow,
			expectedReason:   "",
			expectedErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			builder := &AppPluginAPIBuilder{
				pluginJSON: plugins.JSONData{
					ID: "test-app",
				},
				accessChecker: NewPluginAccessChecker(&tt.fakeAC),
			}

			for _, request := range []struct {
				name     string
				attr     authorizer.AttributesRecord
				decision authorizer.Decision
			}{
				{
					name:     "manifest kind",
					attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "testkinds", Verb: "create"},
					decision: authorizer.DecisionAllow,
				},
				{
					name:     "app settings",
					attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "app", Verb: "update"},
					decision: authorizer.DecisionNoOpinion,
				},
				{
					name:     "app subresource",
					attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "app", Subresource: "resources", Verb: "create"},
					decision: authorizer.DecisionNoOpinion,
				},
				{
					name:     "non-resource request",
					attr:     authorizer.AttributesRecord{Path: "/apis/test-app/v1", Verb: "get"},
					decision: authorizer.DecisionNoOpinion,
				},
			} {
				t.Run(request.name, func(t *testing.T) {
					decision, reason, err := builder.GetAuthorizer().Authorize(tt.ctx, request.attr)
					expectedDecision := tt.expectedDecision
					if expectedDecision == authorizer.DecisionAllow {
						expectedDecision = request.decision
					}
					require.Equal(t, expectedDecision, decision)
					require.Equal(t, tt.expectedReason, reason)
					if tt.expectedErr {
						require.Error(t, err)
					} else {
						require.NoError(t, err)
					}
				})
			}
		})
	}
}

// Manifest kinds follow the rules apiextensions applies to CRDs: a namespaced
// kind is decided at the storage layer, which knows the object's folder, and a
// cluster-scoped kind is only reachable by users when the manifest says so.
func TestGetAuthorizerManifestKinds(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions[1].Kinds = append(manifest.Versions[1].Kinds,
		app.ManifestVersionKind{Kind: "Secret", Plural: "Secrets", Scope: kindstore.ClusterScope,
			Routes: map[string]spec3.PathProps{"/rotate": {Post: &spec3.Operation{}}}},
		app.ManifestVersionKind{Kind: "Setting", Plural: "Settings", Scope: kindstore.ClusterScope, UserReadable: true,
			Routes: map[string]spec3.PathProps{"/reload": {Post: &spec3.Operation{}}}},
	)

	b := &AppPluginAPIBuilder{
		pluginJSON:    plugins.JSONData{ID: "test-app"},
		kindPolicies:  kindPolicies(manifest),
		accessChecker: NewPluginAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: true}),
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
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "testkinds", Verb: "create"},
			decision: authorizer.DecisionAllow,
		},
		{
			name:     "the settings API defers to the remaining authorizers",
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "app", Verb: "update"},
			decision: authorizer.DecisionNoOpinion,
		},
		{
			name:     "a cluster-scoped kind is unreadable unless the manifest says otherwise",
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "secrets", Verb: "get"},
			decision: authorizer.DecisionDeny,
			reason:   "cluster-scoped resource not readable by users",
		},
		{
			name:     "a user-readable cluster-scoped kind can be read",
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "settings", Verb: "list"},
			decision: authorizer.DecisionAllow,
		},
		{
			name:     "a user-readable cluster-scoped kind cannot be written",
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "settings", Verb: "update"},
			decision: authorizer.DecisionDeny,
			reason:   "verb not permitted for cluster-scoped resource",
		},
		{
			// Without this an informer over the kind cannot start, and the watch
			// the reader role grants is dead.
			name:     "a user-readable cluster-scoped kind can be watched",
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "settings", Verb: "watch"},
			decision: authorizer.DecisionAllow,
		},
		{
			// The route is served by the plugin, not unified storage, so app
			// access is what authorizes it -- the read-only rule does not apply.
			name:     "a custom route on a cluster-scoped kind is reachable",
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "settings", Subresource: "reload", Verb: "create"},
			decision: authorizer.DecisionAllow,
		},
		{
			name:     "a custom route is reachable on a kind users cannot read",
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "secrets", Subresource: "rotate", Verb: "create"},
			decision: authorizer.DecisionAllow,
		},
		{
			name:     "a subresource the manifest does not declare is still refused",
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "settings", Subresource: "status", Verb: "update"},
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
	b := &AppPluginAPIBuilder{
		pluginJSON:    plugins.JSONData{ID: "test-app"},
		kindPolicies:  kindPolicies(testManifest(t)),
		accessChecker: NewPluginAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: false}),
	}
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1})

	decision, reason, err := b.GetAuthorizer().Authorize(ctx,
		authorizer.AttributesRecord{ResourceRequest: true, Resource: "testkinds", Verb: "get"})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "access denied", reason)
}

func TestGetAuthorizerRoleFallback(t *testing.T) {
	b := &AppPluginAPIBuilder{
		pluginJSON:    plugins.JSONData{ID: "test-app"},
		accessChecker: NewPluginAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: true}),
	}
	gv := schema.GroupVersion{Group: "test-app", Version: "v0alpha1"}
	auth := grafanaauthorizer.NewGrafanaBuiltInSTAuthorizer()
	auth.Register(gv, b.GetAuthorizer())

	for _, tt := range []struct {
		name     string
		role     org.RoleType
		attr     authorizer.AttributesRecord
		decision authorizer.Decision
	}{
		{
			name:     "viewer can read app settings",
			role:     org.RoleViewer,
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "app", Verb: "get"},
			decision: authorizer.DecisionAllow,
		},
		{
			name:     "viewer cannot update app settings despite app access",
			role:     org.RoleViewer,
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "app", Verb: "update"},
			decision: authorizer.DecisionDeny,
		},
		{
			name:     "editor can update app settings",
			role:     org.RoleEditor,
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "app", Verb: "update"},
			decision: authorizer.DecisionAllow,
		},
		{
			name:     "viewer cannot post to app subresources despite app access",
			role:     org.RoleViewer,
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "app", Subresource: "resources", Verb: "create"},
			decision: authorizer.DecisionDeny,
		},
		{
			name:     "non-resource requests also fall through to the role authorizer",
			role:     org.RoleViewer,
			attr:     authorizer.AttributesRecord{Verb: "post", Path: "/apis/test-app/v0alpha1/custom"},
			decision: authorizer.DecisionDeny,
		},
		{
			name:     "manifest kinds still leave permissions to storage",
			role:     org.RoleViewer,
			attr:     authorizer.AttributesRecord{ResourceRequest: true, Resource: "testkinds", Verb: "create"},
			decision: authorizer.DecisionAllow,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			requester := &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: tt.role}
			ctx := identity.WithRequester(context.Background(), requester)
			tt.attr.User = requester
			tt.attr.APIGroup = gv.Group
			tt.attr.APIVersion = gv.Version
			decision, _, err := auth.Authorize(ctx, tt.attr)
			require.NoError(t, err)
			require.Equal(t, tt.decision, decision)
		})
	}
}
