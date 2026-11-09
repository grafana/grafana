package pluginroute

import (
	"context"
	"slices"
	"strings"

	authlib "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// maxOwnedTeams bounds the teams a user's owned names include, so listing does
// not fan out without limit for a user in very many teams.
const maxOwnedTeams = 25

// ownerFromName authorizes a kind from the owner encoded in an object's name
// (user-<id>, team-<uid>, namespace). It only depends on plain values and an
// AccessChecker so the declaration can move into the app manifest.
type ownerFromName struct {
	// A fixed set of names that are OK (typically used with allowMissingParent)
	names []string

	// The names can match these owner patterns
	owners []resource.Owner

	// Org admins may do anything to the kind
	allowOrgAdmin bool

	// An identity that is not a user (an access policy, the image renderer)
	// lists only the namespace's object, instead of every object.
	nonUserNamespaceOnly bool
}

// ownerFromKind is how a kind's naming strategy authorizes it, or nil when the
// kind does not declare one.
func ownerFromKind(group string, kind app.ManifestVersionKind) *ownerFromName {
	strategy := kind.NamingStrategy
	if strategy == nil || strategy.Mode != app.NamingStrategyModeOwner || strategy.Owner == nil {
		return nil
	}
	return &ownerFromName{
		names:                kind.FixedNames,
		owners:               strategy.Owner.Owners,
		allowOrgAdmin:        strategy.Owner.AllowOrgAdmin,
		nonUserNamespaceOnly: hardcodedNonUserNamespaceOnly(group, strings.ToLower(kind.Plural)),
	}
}

// ownedNames returns the object names a user owns, most specific first: the
// order a merge of them needs, where the first value set wins.
func (b *ownerFromName) ownedNames(user identity.Requester) []string {
	var names []string
	if slices.Contains(b.owners, resource.UserResourceOwner) {
		if id := user.GetIdentifier(); id != "" {
			names = append(names, resource.UserOwner(id).AsName())
		}
	}
	if slices.Contains(b.owners, resource.TeamResourceOwner) {
		teams := slices.Clone(user.GetGroups())
		slices.Sort(teams)
		if len(teams) > maxOwnedTeams {
			teams = teams[:maxOwnedTeams]
		}
		for _, team := range teams {
			names = append(names, resource.TeamOwner(team).AsName())
		}
	}
	if slices.Contains(b.owners, resource.NamespaceResourceOwner) {
		names = append(names, resource.NamespaceOwner().AsName())
	}
	return names
}

// nonUserNames returns the names an identity that is not a user may list, and
// false when it may list every object.
func (b *ownerFromName) nonUserNames() ([]string, bool) {
	if !b.nonUserNamespaceOnly {
		return nil, false
	}
	return []string{resource.NamespaceOwner().AsName()}, true
}

func (b *ownerFromName) authorize(ctx context.Context, user identity.Requester, attr authorizer.Attributes, ac authlib.AccessChecker) (authorizer.Decision, string, error) {
	if b.allowOrgAdmin && user.GetOrgRole() == identity.RoleAdmin {
		return authorizer.DecisionAllow, "", nil
	}

	name := attr.GetName()
	if name == "" {
		if attr.IsReadOnly() {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "mutating request without a name", nil
	}
	if slices.Contains(b.names, name) {
		return authorizer.DecisionAllow, "", nil
	}

	info, ok := resource.ParseOwnerFromName(name)
	if !ok {
		return authorizer.DecisionDeny, "name is missing owner", nil
	}
	if !slices.Contains(b.owners, info.Owner) {
		return authorizer.DecisionDeny, "unsupported owner type", nil
	}

	switch info.Owner {
	case resource.NamespaceResourceOwner:
		if attr.IsReadOnly() {
			// Everyone can see the namespace
			return authorizer.DecisionAllow, "", nil
		}
		if user.GetOrgRole() == identity.RoleAdmin {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "must be an org admin to edit", nil

	case resource.UserResourceOwner:
		if user.GetIdentifier() == info.Identifier {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "you are not the owner of the resource", nil

	case resource.TeamResourceOwner:
		// Being able to view a team is not sufficient: you must be a member
		if attr.IsReadOnly() && slices.Contains(user.GetGroups(), info.Identifier) {
			return authorizer.DecisionAllow, "", nil
		}
		if ac == nil {
			return authorizer.DecisionDeny, "no access client configured", nil
		}
		// otherwise you need the same permissions on the team itself
		rsp, err := ac.Check(ctx, user, authlib.CheckRequest{
			Verb:      attr.GetVerb(),
			Group:     "iam.grafana.app",
			Resource:  "teams",
			Namespace: user.GetNamespace(),
			Name:      info.Identifier,
		}, "")
		if err != nil {
			return authorizer.DecisionDeny, "error fetching team permissions", err
		}
		if rsp.Allowed {
			return authorizer.DecisionAllow, "", nil
		}
		return authorizer.DecisionDeny, "no edit permissions for the team", nil

	case resource.UnknownResourceOwner:
		// ParseOwnerFromName never reports one, so no name reaches here.
	}

	// the owner was not explicitly allowed
	return authorizer.DecisionDeny, "owner name not matched", nil
}
