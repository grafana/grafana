package pluginroute

import (
	"context"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestHardcodedNamespaceReadable(t *testing.T) {
	require.True(t, hardcodedNamespaceReadable("banners.grafana.app", "announcement-banners"))

	// The group and the resource must both match, so a plugin group serving a
	// resource of the same name is not readable without RBAC.
	require.False(t, hardcodedNamespaceReadable("banners.ext.grafana.app", "announcement-banners"))
	require.False(t, hardcodedNamespaceReadable("banners.grafana.app", "other"))
}

func TestHardcodedOwnerFromName(t *testing.T) {
	require.Nil(t, hardcodedOwnerFromName("userstorage.ext.grafana.app", "user-storage"))
	require.Nil(t, hardcodedOwnerFromName("userstorage.grafana.app", "other"))

	owned := hardcodedOwnerFromName("userstorage.grafana.app", "user-storage")
	require.NotNil(t, owned)

	// An org admin is not a server admin: they reach only their own objects.
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
		{"owner creates own", user, "create", "svc:abc", authorizer.DecisionAllow},
		{"a create without a name is left to the store", user, "create", "", authorizer.DecisionAllow},
		{"another user's object", user, "get", "svc:xyz", authorizer.DecisionDeny},
		{"create for another user", user, "create", "svc:xyz", authorizer.DecisionDeny},
		{"name without a user", user, "get", "abc", authorizer.DecisionDeny},
		{"name without a service", user, "get", ":abc", authorizer.DecisionDeny},
		{"name with extra parts", user, "get", "svc:abc:x", authorizer.DecisionDeny},
		{"an owner name is not a user storage name", user, "get", "user-abc", authorizer.DecisionDeny},
		{"a user cannot list", user, "list", "", authorizer.DecisionDeny},
		{"a user cannot watch", user, "watch", "", authorizer.DecisionDeny},
		{"a user cannot delete a collection", user, "deletecollection", "", authorizer.DecisionDeny},
		{"server admin gets any", serverAdmin, "get", "svc:abc", authorizer.DecisionAllow},
		{"server admin lists", serverAdmin, "list", "", authorizer.DecisionAllow},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attr := authorizer.AttributesRecord{Verb: tt.verb, Name: tt.obj, ResourceRequest: true}
			got, reason, err := owned.authorize(context.Background(), tt.user, attr, nil)
			require.NoError(t, err)
			require.Equal(t, tt.want, got, reason)
		})
	}
}

func TestParseServiceUserName(t *testing.T) {
	owner, ok := parseServiceUserName("svc:abc")
	require.True(t, ok)
	require.Equal(t, resource.UserOwner("abc"), owner)

	for _, name := range []string{"abc", "svc:", ":abc", "svc:abc:x", "user-abc"} {
		_, ok := parseServiceUserName(name)
		require.False(t, ok, name)
	}
}
