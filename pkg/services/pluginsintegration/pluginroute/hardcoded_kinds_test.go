package pluginroute

import (
	"context"
	"fmt"
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
	// Legacy user storage has a create step, and a write to a missing object
	// is not found rather than a create.
	require.False(t, owned.createOnUpdate)

	// An org admin is not a server admin: they reach only their own objects.
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "abc", OrgRole: authlib.RoleAdmin}
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
		{"a list for the user's own name is still a list", user, "list", "svc:abc", authorizer.DecisionDeny},
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

func TestHardcodedOwnerFromNameLogsDrilldown(t *testing.T) {
	require.Nil(t, hardcodedOwnerFromName("logsdrilldown.ext.grafana.app", "logsdrilldowns"))
	require.Nil(t, hardcodedOwnerFromName(logsDrilldownGroup, "logsdrilldowndefaults"))

	owned := hardcodedOwnerFromName(logsDrilldownGroup, "logsdrilldowns")
	require.NotNil(t, owned)
	// The embedded API server has a create step, and a write to a missing
	// object is not found rather than a create.
	require.False(t, owned.createOnUpdate)

	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "abc", OrgRole: authlib.RoleAdmin}
	serverAdmin := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "root", IsGrafanaAdmin: true}

	tests := []struct {
		name string
		user identity.Requester
		verb string
		obj  string
		want authorizer.Decision
	}{
		{"owner updates own", user, "update", "svc:abc", authorizer.DecisionAllow},
		{"owner creates own", user, "create", "svc:abc", authorizer.DecisionAllow},
		{"a user gets another user's", user, "get", "svc:xyz", authorizer.DecisionAllow},
		{"a user lists", user, "list", "", authorizer.DecisionAllow},
		{"a user updates another user's", user, "update", "svc:xyz", authorizer.DecisionDeny},
		{"a user deletes another user's", user, "delete", "svc:xyz", authorizer.DecisionDeny},
		{"create for another user", user, "create", "svc:xyz", authorizer.DecisionDeny},
		{"a user cannot delete a collection", user, "deletecollection", "", authorizer.DecisionDeny},
		{"server admin updates any", serverAdmin, "update", "svc:abc", authorizer.DecisionAllow},
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

// lastCheckChecker allows when allowed is set, and keeps the last request.
type lastCheckChecker struct {
	allowed bool
	got     *authlib.CheckRequest
}

func (c *lastCheckChecker) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	c.got = &req
	return authlib.CheckResponse{Allowed: c.allowed}, nil
}

func (c *lastCheckChecker) Compile(context.Context, authlib.AuthInfo, authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, nil
}

func TestHardcodedNamespaceReadableLogsDrilldown(t *testing.T) {
	for _, resource := range []string{"logsdrilldowndefaults", "logsdrilldowndefaultcolumns", "logsdrilldowndefaultlabels"} {
		require.True(t, hardcodedNamespaceReadable(logsDrilldownGroup, resource), resource)
		require.False(t, hardcodedNamespaceReadable("logsdrilldown.ext.grafana.app", resource), resource)
	}
	// Each user's settings are authorized by the owner in the name instead.
	require.False(t, hardcodedNamespaceReadable(logsDrilldownGroup, "logsdrilldowns"))
}

func TestAuthorizeNamespaceReadable(t *testing.T) {
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "abc", OrgRole: authlib.RoleViewer}

	for _, verb := range []string{"get", "list"} {
		t.Run(verb+" needs no permission", func(t *testing.T) {
			ac := &lastCheckChecker{}
			got, _, err := authorizeNamespaceReadable(context.Background(), user, authorizer.AttributesRecord{Verb: verb, ResourceRequest: true}, ac)
			require.NoError(t, err)
			require.Equal(t, authorizer.DecisionAllow, got)
			require.Nil(t, ac.got)
		})
	}

	for _, verb := range []string{"watch", "create", "update", "patch", "delete", "deletecollection"} {
		for _, allowed := range []bool{true, false} {
			t.Run(fmt.Sprintf("%s checks the kind's mapping, allowed=%v", verb, allowed), func(t *testing.T) {
				ac := &lastCheckChecker{allowed: allowed}
				attr := authorizer.AttributesRecord{
					Verb: verb, APIGroup: logsDrilldownGroup, Resource: "logsdrilldowndefaultlabels",
					Namespace: "stacks-1", Name: "defaults", ResourceRequest: true,
				}
				got, _, err := authorizeNamespaceReadable(context.Background(), user, attr, ac)
				require.NoError(t, err)
				want := authorizer.DecisionDeny
				if allowed {
					want = authorizer.DecisionAllow
				}
				require.Equal(t, want, got)
				require.Equal(t, &authlib.CheckRequest{
					Verb: verb, Group: logsDrilldownGroup, Resource: "logsdrilldowndefaultlabels",
					Namespace: "stacks-1", Name: "defaults",
				}, ac.got)
			})
		}
	}

	t.Run("without an access client a write is denied", func(t *testing.T) {
		got, _, err := authorizeNamespaceReadable(context.Background(), user, authorizer.AttributesRecord{Verb: "update", ResourceRequest: true}, nil)
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, got)
	})

	t.Run("an access client error denies", func(t *testing.T) {
		got, _, err := authorizeNamespaceReadable(context.Background(), user, authorizer.AttributesRecord{Verb: "update", ResourceRequest: true}, errChecker{})
		require.ErrorContains(t, err, "boom")
		require.Equal(t, authorizer.DecisionDeny, got)
	})
}
