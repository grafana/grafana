package provisioning

import (
	"context"
	"fmt"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	mock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/bootstrap"
	"github.com/grafana/grafana/pkg/setting"
)

func subresourceAttrsWithVerb(sub, name, ns, verb string) authorizer.Attributes {
	return authorizer.AttributesRecord{
		Subresource: sub,
		Name:        name,
		Namespace:   ns,
		Verb:        verb,
	}
}

// TestAuthorizeConnectionSubresource verifies which verb each connection subresource
// checks against the connections resource.
//
// The connection root and its status subresource must forward the request verb: status
// carries mutating endpoints (PUT/PATCH), so pinning the check to a read verb would let a
// caller holding only connections:read write connection status.
//
// repositories and authorize intentionally ignore the request verb: repositories is an
// inspection view (always connections:read) and authorize mutates connection secrets
// (always connections:write), regardless of the HTTP method used to reach them.
func TestAuthorizeConnectionSubresource(t *testing.T) {
	ctx := context.Background()
	const ns, name = "default", "my-connection"

	connReq := func(verb string) func(authlib.CheckRequest) bool {
		return func(req authlib.CheckRequest) bool {
			return req.Verb == verb &&
				req.Group == provisioning.GROUP &&
				req.Resource == provisioning.ConnectionResourceInfo.GetName() &&
				req.Name == name &&
				req.Namespace == ns
		}
	}

	// readOnlyChecker stands in for a caller granted connections:read but not
	// connections:write: any non-read verb is forbidden.
	readOnlyChecker := func(t *testing.T) *auth.MockAccessChecker {
		checker := auth.NewMockAccessChecker(t)
		checker.EXPECT().Check(mock.Anything, mock.Anything, "").
			RunAndReturn(func(_ context.Context, req authlib.CheckRequest, _ string) error {
				if req.Verb == utils.VerbGet || req.Verb == utils.VerbList {
					return nil
				}
				return mockForbidden()
			})
		return checker
	}

	// Both the connection root and status must forward the request verb unchanged.
	for _, sub := range []string{"", "status"} {
		label := sub
		if label == "" {
			label = "connection root"
		}

		for _, verb := range []string{utils.VerbGet, utils.VerbList, utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete} {
			t.Run(fmt.Sprintf("%s: %s is checked as connections:%s and allowed", label, verb, verb), func(t *testing.T) {
				adminChecker := auth.NewMockAccessChecker(t)
				adminChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(connReq(verb)), "").Return(nil)

				b := &APIBuilder{accessWithAdmin: adminChecker}
				decision, _, err := b.authorizeConnectionSubresource(ctx, subresourceAttrsWithVerb(sub, name, ns, verb))
				require.NoError(t, err)
				assert.Equal(t, authorizer.DecisionAllow, decision)
			})

			t.Run(fmt.Sprintf("%s: %s is denied when connections:%s is denied", label, verb, verb), func(t *testing.T) {
				adminChecker := auth.NewMockAccessChecker(t)
				adminChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(connReq(verb)), "").Return(mockForbidden())

				b := &APIBuilder{accessWithAdmin: adminChecker}
				decision, reason, err := b.authorizeConnectionSubresource(ctx, subresourceAttrsWithVerb(sub, name, ns, verb))
				require.NoError(t, err)
				assert.Equal(t, authorizer.DecisionDeny, decision)
				assert.NotEmpty(t, reason)
			})
		}

		// A read-only caller must not be able to mutate through this path.
		for _, verb := range []string{utils.VerbCreate, utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete} {
			t.Run(fmt.Sprintf("%s: read-only caller is denied %s", label, verb), func(t *testing.T) {
				b := &APIBuilder{accessWithAdmin: readOnlyChecker(t)}
				decision, _, err := b.authorizeConnectionSubresource(ctx, subresourceAttrsWithVerb(sub, name, ns, verb))
				require.NoError(t, err)
				assert.Equal(t, authorizer.DecisionDeny, decision)
			})
		}

		t.Run(label+": read-only caller is allowed get", func(t *testing.T) {
			b := &APIBuilder{accessWithAdmin: readOnlyChecker(t)}
			decision, _, err := b.authorizeConnectionSubresource(ctx, subresourceAttrsWithVerb(sub, name, ns, utils.VerbGet))
			require.NoError(t, err)
			assert.Equal(t, authorizer.DecisionAllow, decision)
		})
	}

	// repositories always checks connections:read, whatever verb the request carries.
	for _, verb := range []string{utils.VerbGet, utils.VerbList, utils.VerbUpdate} {
		t.Run("repositories: "+verb+" is checked as connections:get", func(t *testing.T) {
			adminChecker := auth.NewMockAccessChecker(t)
			adminChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(connReq(utils.VerbGet)), "").Return(nil)

			b := &APIBuilder{accessWithAdmin: adminChecker}
			decision, _, err := b.authorizeConnectionSubresource(ctx, subresourceAttrsWithVerb("repositories", name, ns, verb))
			require.NoError(t, err)
			assert.Equal(t, authorizer.DecisionAllow, decision)
		})
	}

	t.Run("repositories: denied when connections:get is denied", func(t *testing.T) {
		adminChecker := auth.NewMockAccessChecker(t)
		adminChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(connReq(utils.VerbGet)), "").Return(mockForbidden())

		b := &APIBuilder{accessWithAdmin: adminChecker}
		decision, _, err := b.authorizeConnectionSubresource(ctx, subresourceAttrs("repositories", name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	// authorize always checks connections:write, even on a GET, because it rotates secrets.
	for _, verb := range []string{utils.VerbGet, utils.VerbCreate, utils.VerbUpdate} {
		t.Run("authorize: "+verb+" is checked as connections:update", func(t *testing.T) {
			adminChecker := auth.NewMockAccessChecker(t)
			adminChecker.EXPECT().Check(mock.Anything, mock.MatchedBy(connReq(utils.VerbUpdate)), "").Return(nil)

			b := &APIBuilder{accessWithAdmin: adminChecker}
			decision, _, err := b.authorizeConnectionSubresource(ctx, subresourceAttrsWithVerb("authorize", name, ns, verb))
			require.NoError(t, err)
			assert.Equal(t, authorizer.DecisionAllow, decision)
		})
	}

	t.Run("authorize: read-only caller is denied even on get", func(t *testing.T) {
		b := &APIBuilder{accessWithAdmin: readOnlyChecker(t)}
		decision, _, err := b.authorizeConnectionSubresource(ctx, subresourceAttrsWithVerb("authorize", name, ns, utils.VerbGet))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("unmapped subresource: grafana admin is allowed", func(t *testing.T) {
		adminCtx := identity.WithRequester(ctx, &identity.StaticRequester{IsGrafanaAdmin: true})

		b := &APIBuilder{}
		decision, _, err := b.authorizeConnectionSubresource(adminCtx, subresourceAttrs("something-new", name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("unmapped subresource: non grafana admin is denied", func(t *testing.T) {
		userCtx := identity.WithRequester(ctx, &identity.StaticRequester{IsGrafanaAdmin: false})

		b := &APIBuilder{}
		decision, reason, err := b.authorizeConnectionSubresource(userCtx, subresourceAttrs("something-new", name, ns))
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
		assert.Equal(t, "unmapped subresource defaults to no access", reason)
	})

	t.Run("unmapped subresource: missing requester is denied", func(t *testing.T) {
		b := &APIBuilder{}
		decision, _, err := b.authorizeConnectionSubresource(ctx, subresourceAttrs("something-new", name, ns))
		require.Error(t, err)
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})
}

func TestBootstrapConfigFromSettings(t *testing.T) {
	tests := []struct {
		name            string
		path            string
		repositoryTypes []string
		allowedTargets  []string
		want            bootstrap.Config
		wantErr         bool
	}{
		{
			// Still carries the namespace: the post-start hook needs one to find and stop a
			// repository an earlier run registered.
			name: "disabled but still reconcilable when no path is configured",
			want: bootstrap.Config{Namespace: "default"},
		},
		{
			name: "targets the default org namespace",
			path: "conf/provisioning/bootstrap",
			want: bootstrap.Config{Path: "conf/provisioning/bootstrap", Namespace: "default"},
		},
		{
			name:            "accepts an explicit type list that enables local repositories",
			path:            "conf/provisioning/bootstrap",
			repositoryTypes: []string{"github", "local"},
			want:            bootstrap.Config{Path: "conf/provisioning/bootstrap", Namespace: "default"},
		},
		{
			// The path is added to the local-repository allowlist, which is matched by prefix,
			// so the empty prefix a cleaned root produces would permit every path.
			name:    "rejects the filesystem root",
			path:    "/",
			wantErr: true,
		},
		{
			name:    "rejects a path admission would reject",
			path:    "../../../etc",
			wantErr: true,
		},
		{
			name:            "rejects a bootstrap path when local repositories are disabled",
			path:            "conf/provisioning/bootstrap",
			repositoryTypes: []string{"github"},
			wantErr:         true,
		},
		{
			// Admission would reject the repository, leaving the instance unprovisioned with
			// nothing in the configuration to say why.
			name:           "rejects a bootstrap path when its sync target is not allowed",
			path:           "conf/provisioning/bootstrap",
			allowedTargets: []string{"folder"},
			wantErr:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			allowedTargets := tt.allowedTargets
			if allowedTargets == nil {
				allowedTargets = []string{"folder", "folderless"}
			}
			got, err := bootstrapConfigFromSettings(&setting.Cfg{
				ProvisioningBootstrapPath:   tt.path,
				ProvisioningRepositoryTypes: tt.repositoryTypes,
				ProvisioningAllowedTargets:  allowedTargets,
			})
			if tt.wantErr {
				assert.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestAllowedSyncTargets(t *testing.T) {
	configured := []string{"folder", "instance", "folderless"}

	assert.Equal(t, []provisioning.SyncTargetType{"folder", "instance", "folderless"},
		allowedSyncTargets(configured, false))
	assert.Equal(t, []provisioning.SyncTargetType{"folder", "folderless"},
		allowedSyncTargets(configured, true))
}
