package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/auth"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// operatorTokenPermissions is the provisioning half of what the operators' access policies grant in
// cloud; the folder, dashboard and secret entries are elided. Deliberately carries no `stats` entry:
// the operators read per-repository counts, never the namespace-wide ones.
var operatorTokenPermissions = []string{
	"provisioning.grafana.app/repositories:*",
	"provisioning.grafana.app/jobs:*",
	"provisioning.grafana.app/historicjobs:*",
	"provisioning.grafana.app/connections:*",
}

// TestOperatorAuthorization pins what admits the operators to the two subresources they read
// instead of unified storage. They arrive as an access policy scoped to every namespace, not as the
// in-process service identity, so the token's own permissions are what decide — and the subresource
// is invisible to that check, which is why one repositories grant covers both routes.
func TestOperatorAuthorization(t *testing.T) {
	const ns, repo = "stacks-1234", "my-repo"

	subresource := func(sub string) authorizer.Attributes {
		return authorizer.AttributesRecord{
			APIGroup: provisioning.GROUP, Resource: "repositories", Subresource: sub,
			Name: repo, Namespace: ns, Verb: "get", ResourceRequest: true,
		}
	}

	tests := []struct {
		name        string
		subresource string
		permissions []string
		want        authorizer.Decision
	}{
		{
			name:        "resources: allowed by the repositories grant the operators hold",
			subresource: "resources",
			permissions: operatorTokenPermissions,
			want:        authorizer.DecisionAllow,
		},
		{
			name:        "stats: allowed by the same grant, with no stats permission",
			subresource: "stats",
			permissions: operatorTokenPermissions,
			want:        authorizer.DecisionAllow,
		},
		{
			name:        "resources: denied without the repositories grant",
			subresource: "resources",
			permissions: []string{"provisioning.grafana.app/jobs:*"},
			want:        authorizer.DecisionDeny,
		},
		{
			name:        "stats: denied without it, and a stats grant does not substitute",
			subresource: "stats",
			permissions: []string{"provisioning.grafana.app/stats:*"},
			want:        authorizer.DecisionDeny,
		},
	}

	// Both checkers end at the same token evaluation for an access policy; they differ only in how
	// they word the denial, since the session checker's Admin fallback is configured but cannot fire
	// for a service call, which carries no org role.
	checkers := map[string]struct {
		new        func(authlib.AccessChecker) auth.AccessChecker
		denialTail string
	}{
		"token":   {auth.NewTokenAccessChecker, "is forbidden: permission denied"},
		"session": {auth.NewSessionAccessChecker, "is forbidden: admin role is required"},
	}

	for mode, checker := range checkers {
		for _, tt := range tests {
			t.Run(mode+"/"+tt.name, func(t *testing.T) {
				ctx := identity.WithRequester(context.Background(), operatorIdentity(tt.permissions))
				require.False(t, identity.IsServiceIdentity(ctx),
					"the exchanged token must not take the in-process service identity fast path")

				// The real access client with no connection: a check for an access policy resolves
				// from the token permissions and never reaches the transport.
				access := checker.new(authz.NewClient(nil))
				b := &APIBuilder{accessWithAdmin: access.WithFallbackRole(identity.RoleAdmin)}

				decision, reason, err := b.GetAuthorizer().Authorize(ctx, subresource(tt.subresource))
				require.NoError(t, err)
				assert.Equal(t, tt.want, decision)
				if tt.want == authorizer.DecisionDeny {
					assert.Contains(t, reason, checker.denialTail)
				}
			})
		}
	}
}

func operatorIdentity(permissions []string) *identity.StaticRequester {
	return &identity.StaticRequester{
		Type:      authlib.TypeAccessPolicy,
		UserUID:   "provisioning-repo-operator",
		Namespace: "*",
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{Namespace: "*", Permissions: permissions},
		},
	}
}
