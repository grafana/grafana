package pluginroute

import (
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestHardcodedNamespaceReadable(t *testing.T) {
	require.True(t, hardcodedNamespaceReadable("banners.grafana.app", "announcement-banners"))

	// The group and the resource must both match, so a plugin group serving a
	// resource of the same name is not readable without RBAC.
	require.False(t, hardcodedNamespaceReadable("banners.ext.grafana.app", "announcement-banners"))
	require.False(t, hardcodedNamespaceReadable("banners.grafana.app", "other"))
}

func TestAuthorizeUserStorage(t *testing.T) {
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "abc", OrgRole: identity.RoleAdmin}
	serverAdmin := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "root", IsGrafanaAdmin: true}

	tests := []struct {
		name string
		user identity.Requester
		verb string
		obj  string
		want authorizer.Decision
	}{
		{"owner gets own", user, "get", "svc:abc", authorizer.DecisionAllow},
		{"owner updates own", user, "update", "svc:abc", authorizer.DecisionAllow},
		{"owner patches own", user, "patch", "svc:abc", authorizer.DecisionAllow},
		{"owner deletes own", user, "delete", "svc:abc", authorizer.DecisionAllow},
		{"create is checked on admission", user, "create", "", authorizer.DecisionAllow},
		{"another user's object", user, "get", "svc:xyz", authorizer.DecisionDeny},
		{"name without a user", user, "get", "abc", authorizer.DecisionDeny},
		{"name with extra parts", user, "get", "svc:abc:x", authorizer.DecisionDeny},
		{"org admin cannot list", user, "list", "", authorizer.DecisionDeny},
		{"org admin cannot watch", user, "watch", "", authorizer.DecisionDeny},
		{"server admin gets any", serverAdmin, "get", "svc:abc", authorizer.DecisionAllow},
		{"server admin lists", serverAdmin, "list", "", authorizer.DecisionAllow},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attr := authorizer.AttributesRecord{Verb: tt.verb, Name: tt.obj, ResourceRequest: true}
			got, _, err := authorizeUserStorage(tt.user, attr)
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}
