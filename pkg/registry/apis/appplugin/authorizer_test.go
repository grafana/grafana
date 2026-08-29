package appplugin

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
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
			name:             "allows when user has permission",
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

			auth := builder.GetAuthorizer()
			decision, reason, err := auth.Authorize(tt.ctx, authorizer.AttributesRecord{})

			require.Equal(t, tt.expectedDecision, decision)
			require.Equal(t, tt.expectedReason, reason)
			if tt.expectedErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
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
		app.ManifestVersionKind{Kind: "Secret", Plural: "Secrets", Scope: clusterScope},
		app.ManifestVersionKind{Kind: "Setting", Plural: "Settings", Scope: clusterScope, UserReadable: true},
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
		authorizer.AttributesRecord{Resource: "testkinds", Verb: "get"})
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "access denied", reason)
}
