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

// operatorTokenPermissions is the provisioning half of what the operators' access policies grant
// in cloud; the folder, dashboard and secret entries are elided.
var operatorTokenPermissions = []string{
	"provisioning.grafana.app/repositories:*",
	"provisioning.grafana.app/jobs:*",
	"provisioning.grafana.app/historicjobs:*",
	"provisioning.grafana.app/connections:*",
}

// TestOperatorAuthorization pins the grants the provisioning operators need to read the managed
// resource list and the namespace stats over the API server instead of unified storage. The
// operators arrive as an access policy scoped to every namespace, not as the in-process service
// identity, so the token's own permissions are what decide.
func TestOperatorAuthorization(t *testing.T) {
	const ns, repo = "stacks-1234", "my-repo"

	resourcesAttrs := authorizer.AttributesRecord{
		APIGroup: provisioning.GROUP, Resource: "repositories", Subresource: "resources",
		Name: repo, Namespace: ns, Verb: "get", ResourceRequest: true,
	}
	statsAttrs := authorizer.AttributesRecord{
		APIGroup: provisioning.GROUP, Resource: "stats",
		Namespace: ns, Verb: "list", ResourceRequest: true,
	}

	tests := []struct {
		name        string
		attrs       authorizer.Attributes
		permissions []string
		want        authorizer.Decision
	}{
		{
			name:        "repository resources: allowed by the repositories grant the operators already hold",
			attrs:       resourcesAttrs,
			permissions: operatorTokenPermissions,
			want:        authorizer.DecisionAllow,
		},
		{
			name:        "repository resources: denied without it",
			attrs:       resourcesAttrs,
			permissions: []string{"provisioning.grafana.app/jobs:*"},
			want:        authorizer.DecisionDeny,
		},
		{
			name:        "namespace stats: denied by the operators' current grants",
			attrs:       statsAttrs,
			permissions: operatorTokenPermissions,
			want:        authorizer.DecisionDeny,
		},
		{
			name:        "namespace stats: allowed once the policy grants stats:get",
			attrs:       statsAttrs,
			permissions: append([]string{"provisioning.grafana.app/stats:get"}, operatorTokenPermissions...),
			want:        authorizer.DecisionAllow,
		},
	}

	// Both checkers end at the same token evaluation for an access policy; they differ only in
	// how they word the denial, since the session checker's Admin fallback is configured but
	// cannot fire for a service call, which carries no org role.
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

				// The real access client with no connection: a check for an access policy
				// resolves from the token permissions and never reaches the transport.
				access := checker.new(authz.NewClient(nil))
				b := &APIBuilder{accessWithAdmin: access.WithFallbackRole(identity.RoleAdmin)}

				decision, reason, err := b.GetAuthorizer().Authorize(ctx, tt.attrs)
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
		UserUID:   "provisioning-jobs-operator",
		Namespace: "*",
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{
			Rest: authnlib.AccessTokenClaims{Namespace: "*", Permissions: permissions},
		},
	}
}
