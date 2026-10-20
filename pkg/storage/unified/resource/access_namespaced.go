package resource

import (
	"slices"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// servicePermission formats a token permission for one resource of a group.
func servicePermission(group, resource, verb string) string {
	return group + "/" + resource + ":" + verb
}

// withNamespacedGroupGrants returns id with grants added to the token
// permissions authlib checks for it: its own for a service call, its delegated
// ones on behalf of a user. Storage has already granted them through the
// namespaced groups' owner (namespacedgroups.CheckServicePermissions), and the access client it calls
// next (authlib's authz.ClientImpl) checks service permissions again, against
// the namespaced group itself, before asking the authz service about the user.
//
// An identity.Requester stays one, for access clients that need it.
func withNamespacedGroupGrants(id claims.AuthInfo, grants ...string) claims.AuthInfo {
	permissions, delegated := id.GetTokenPermissions(), id.GetTokenDelegatedPermissions()
	if claims.IsIdentityType(id.GetIdentityType(), claims.TypeAccessPolicy) {
		permissions = slices.Concat(permissions, grants)
	} else {
		delegated = slices.Concat(delegated, grants)
	}
	if requester, ok := id.(identity.Requester); ok {
		return grantedRequester{Requester: requester, permissions: permissions, delegated: delegated}
	}
	return grantedAuthInfo{AuthInfo: id, permissions: permissions, delegated: delegated}
}

type grantedAuthInfo struct {
	claims.AuthInfo
	permissions, delegated []string
}

func (g grantedAuthInfo) GetTokenPermissions() []string          { return g.permissions }
func (g grantedAuthInfo) GetTokenDelegatedPermissions() []string { return g.delegated }

type grantedRequester struct {
	identity.Requester
	permissions, delegated []string
}

func (g grantedRequester) GetTokenPermissions() []string          { return g.permissions }
func (g grantedRequester) GetTokenDelegatedPermissions() []string { return g.delegated }
