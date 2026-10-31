package pluginroute

import (
	"context"
	"errors"
	"fmt"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
)

type errChecker struct{}

func (errChecker) Check(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{}, errors.New("boom")
}

func (errChecker) Compile(context.Context, authlib.AuthInfo, authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, errors.New("boom")
}

func TestOwnerFromNameAuthorize(t *testing.T) {
	user := &identity.StaticRequester{UserUID: "abc", Groups: []string{"team1"}, OrgRole: identity.RoleEditor}
	admin := &identity.StaticRequester{UserUID: "root", OrgRole: identity.RoleAdmin}
	all := []apiutils.ResourceOwner{apiutils.NamespaceResourceOwner, apiutils.UserResourceOwner, apiutils.TeamResourceOwner}

	tests := []struct {
		name   string
		policy ownerFromName
		access authlib.AccessChecker
		user   identity.Requester
		verb   string
		obj    string
		want   authorizer.Decision
		err    string
	}{
		{name: "list without a name", policy: ownerFromName{owners: all}, user: user, verb: "list", want: authorizer.DecisionAllow},
		{name: "create without a name", policy: ownerFromName{owners: all}, user: user, verb: "create", want: authorizer.DecisionDeny},
		{name: "fixed name", policy: ownerFromName{names: []string{"merged"}}, user: user, verb: "get", obj: "merged", want: authorizer.DecisionAllow},
		{name: "own user", policy: ownerFromName{owners: all}, user: user, verb: "update", obj: "user-abc", want: authorizer.DecisionAllow},
		{name: "other user", policy: ownerFromName{owners: all}, user: user, verb: "get", obj: "user-xyz", want: authorizer.DecisionDeny},
		{name: "org admin", policy: ownerFromName{owners: all, allowOrgAdmin: true}, user: admin, verb: "delete", obj: "user-xyz", want: authorizer.DecisionAllow},
		{name: "org admin not allowed", policy: ownerFromName{owners: all}, user: admin, verb: "get", obj: "user-xyz", want: authorizer.DecisionDeny},
		{name: "unsupported owner", policy: ownerFromName{owners: []apiutils.ResourceOwner{apiutils.UserResourceOwner}}, user: user, verb: "get", obj: "team-team1", want: authorizer.DecisionDeny},
		{name: "unknown owner is denied", policy: ownerFromName{owners: all}, user: user, verb: "get", obj: "whatever", want: authorizer.DecisionDeny},
		{name: "namespace read", policy: ownerFromName{owners: all}, user: user, verb: "get", obj: "namespace", want: authorizer.DecisionAllow},
		{name: "namespace write by editor", policy: ownerFromName{owners: all}, user: user, verb: "update", obj: "namespace", want: authorizer.DecisionDeny},
		{name: "namespace write by admin", policy: ownerFromName{owners: all}, user: admin, verb: "update", obj: "namespace", want: authorizer.DecisionAllow},
		{name: "team member reads", policy: ownerFromName{owners: all}, user: user, verb: "get", obj: "team-team1", want: authorizer.DecisionAllow},
		{name: "team non-member via access client", policy: ownerFromName{owners: all}, access: authlib.FixedAccessClient(true), user: user, verb: "get", obj: "team-other", want: authorizer.DecisionAllow},
		{name: "team non-member denied", policy: ownerFromName{owners: all}, access: authlib.FixedAccessClient(false), user: user, verb: "get", obj: "team-other", want: authorizer.DecisionDeny},
		{name: "team without access client", policy: ownerFromName{owners: all}, user: user, verb: "update", obj: "team-team1", want: authorizer.DecisionDeny},
		{name: "team access client error", policy: ownerFromName{owners: all}, access: errChecker{}, user: user, verb: "get", obj: "team-other", want: authorizer.DecisionDeny, err: "boom"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attr := authorizer.AttributesRecord{User: nil, Verb: tt.verb, Name: tt.obj, ResourceRequest: true}
			d, _, err := tt.policy.authorize(context.Background(), tt.user, attr, tt.access)
			if tt.err != "" {
				require.ErrorContains(t, err, tt.err)
			} else {
				require.NoError(t, err)
			}
			require.Equal(t, tt.want, d)
		})
	}
}

func TestOwnerFromNameOwnedNames(t *testing.T) {
	user := &identity.StaticRequester{UserUID: "abc", Groups: []string{"t2", "t1"}}

	t.Run("stars are only the user's own", func(t *testing.T) {
		o, _ := hardcodedKindAuth("collections.grafana.app", "stars")
		require.Equal(t, []string{"user-abc"}, o.ownedNames(user))
	})

	t.Run("a namespace owner is user, sorted teams, then namespace", func(t *testing.T) {
		o := namespaceUserTeamOwner()
		require.Equal(t, []string{"user-abc", "team-t1", "team-t2", "namespace"}, o.ownedNames(user))
	})

	t.Run("only nonUserNamespaceOnly limits other identities to the namespace", func(t *testing.T) {
		o := namespaceUserTeamOwner()
		names, scoped := o.nonUserNames()
		require.True(t, scoped)
		require.Equal(t, []string{"namespace"}, names)

		o, _ = hardcodedKindAuth("collections.grafana.app", "stars")
		_, scoped = o.nonUserNames()
		require.False(t, scoped)
	})

	t.Run("teams are capped", func(t *testing.T) {
		many := &identity.StaticRequester{UserUID: "abc"}
		for i := range maxOwnedTeams + 10 {
			many.Groups = append(many.Groups, fmt.Sprintf("t%03d", i))
		}
		o := namespaceUserTeamOwner()
		require.Len(t, o.ownedNames(many), maxOwnedTeams+2)
	})

	t.Run("other kinds are not scoped", func(t *testing.T) {
		o, _ := hardcodedKindAuth("other.ext.grafana.app", "things")
		require.Nil(t, o)
	})
}

// A kind authorized by name is decided by the caller's name, except for an
// access policy, which is held to the permissions in its token.
func TestGetAuthorizerOwnerFromName(t *testing.T) {
	owner, _ := hardcodedKindAuth("collections.grafana.app", "stars")
	b := &manifestBuilder{
		pluginID:      "test-app",
		kindPolicies:  map[string]kindPolicy{"stars": {ownerFromName: owner}},
		accessChecker: pluginaccesscontrol.NewAppAccessChecker(&actest.FakeAccessControl{ExpectedEvaluate: true}),
	}
	attr := func(verb, name string) authorizer.Attributes {
		return authorizer.AttributesRecord{APIGroup: "collections.grafana.app", Resource: "stars", Verb: verb, Name: name}
	}
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "abc", OrgID: 1, OrgRole: identity.RoleEditor}
	admin := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "root", OrgID: 1, OrgRole: identity.RoleAdmin}

	for name, tc := range map[string]struct {
		caller identity.Requester
		verb   string
		object string
		want   authorizer.Decision
	}{
		"a user writes their own":            {user, "update", "user-abc", authorizer.DecisionAllow},
		"a user may not read another's":      {user, "get", "user-other", authorizer.DecisionDeny},
		"a user may list":                    {user, "list", "", authorizer.DecisionAllow},
		"a user may not create without name": {user, "create", "", authorizer.DecisionDeny},
		"an org admin writes another's":      {admin, "update", "user-abc", authorizer.DecisionAllow},
		"an access policy with the grant":    {accessPolicy("collections.grafana.app/stars:get"), "get", "user-other", authorizer.DecisionAllow},
		"an access policy without the grant": {accessPolicy(), "get", "user-abc", authorizer.DecisionDeny},
		"an access policy past its grant":    {accessPolicy("collections.grafana.app/stars:get"), "update", "user-abc", authorizer.DecisionDeny},
	} {
		t.Run(name, func(t *testing.T) {
			decision, reason := authorize(t, b, tc.caller, attr(tc.verb, tc.object))
			require.Equal(t, tc.want, decision, reason)
		})
	}
}

// namespaceUserTeamOwner is a policy for a kind whose objects are owned by a
// user, a team or the namespace. Only the generic owner mechanics are tested
// with it; no kind served here uses it.
func namespaceUserTeamOwner() *ownerFromName {
	return &ownerFromName{
		names: []string{"merged"},
		owners: []apiutils.ResourceOwner{
			apiutils.NamespaceResourceOwner,
			apiutils.UserResourceOwner,
			apiutils.TeamResourceOwner,
		},
		nonUserNamespaceOnly: true,
	}
}
