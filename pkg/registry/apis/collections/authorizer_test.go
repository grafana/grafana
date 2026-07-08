package collections

import (
	"context"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestStarsAuthorizer(t *testing.T) {
	withStarsPermission := &authn.Claims[authn.AccessTokenClaims]{
		Rest: authn.AccessTokenClaims{
			DelegatedPermissions: []string{"collections.grafana.app/stars:*"},
		},
	}
	noPermission := &authn.Claims[authn.AccessTokenClaims]{
		Rest: authn.AccessTokenClaims{DelegatedPermissions: []string{""}},
	}

	admin := &identity.StaticRequester{UserUID: "admin", OrgRole: identity.RoleAdmin, AccessTokenClaims: withStarsPermission}
	viewer := &identity.StaticRequester{UserUID: "viewer", OrgRole: identity.RoleViewer, AccessTokenClaims: withStarsPermission}
	adminNoPerm := &identity.StaticRequester{UserUID: "admin", OrgRole: identity.RoleAdmin, AccessTokenClaims: noPermission}

	update := func(name string) authorizer.AttributesRecord {
		return authorizer.AttributesRecord{
			Verb:            "update",
			APIGroup:        "collections.grafana.app",
			Resource:        "stars",
			Name:            name,
			ResourceRequest: true,
		}
	}

	tests := []struct {
		name     string
		user     identity.Requester
		attr     authorizer.AttributesRecord
		expected authorizer.Decision
	}{
		{"user manages own stars", viewer, update("user-viewer"), authorizer.DecisionAllow},
		{"user denied for another user", viewer, update("user-other"), authorizer.DecisionDeny},
		{"admin manages own stars", admin, update("user-admin"), authorizer.DecisionAllow},
		{"admin manages another user's stars", admin, update("user-other"), authorizer.DecisionAllow},
		{"admin without stars permission denied", adminNoPerm, update("user-other"), authorizer.DecisionDeny},
		{"non-user owner denied", admin, update("team-abc"), authorizer.DecisionDeny},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), tt.user)
			d, _, err := newStarsAuthorizer().Authorize(ctx, tt.attr)
			require.NoError(t, err)
			require.Equal(t, tt.expected, d)
		})
	}
}
