package namespacedgroups

import (
	"strings"

	"github.com/grafana/authlib/authz"
	claims "github.com/grafana/authlib/types"
)

// CheckServicePermissions checks the caller's token permissions as
// authz.CheckServicePermissions does, except that a namespaced group of the
// request's namespace (see Owner) may also be granted through its owner group.
// viaOwner reports that it was.
//
// No token can name a namespaced group, and authlib's *.ext.grafana.app
// wildcard only matches a single label. The owner plugin serves the group, so a
// permission for the owner's whole group, such as <owner>:* or
// *.ext.grafana.app:*, stands for it. A permission for one of the owner's
// resources does not, since the owner's resources are not the namespaced
// group's. This is for service permissions only: RBAC still checks the user
// against the namespaced group itself.
func CheckServicePermissions(id claims.AuthInfo, namespace, group, resource, verb string) (res authz.ServiceEvaluationResult, viaOwner bool) {
	res = authz.CheckServicePermissions(id, group, resource, verb)
	if res.Allowed {
		return res, false
	}
	owner, ok := Owner(group, namespace)
	if !ok {
		return res, false
	}
	ownerRes := authz.CheckServicePermissions(groupWidePermissions{id}, owner, resource, verb)
	if !ownerRes.Allowed {
		return res, false
	}
	return ownerRes, true
}

// groupWidePermissions keeps only the permissions of id's token that name no
// resource.
type groupWidePermissions struct {
	claims.AuthInfo
}

func (g groupWidePermissions) GetTokenPermissions() []string {
	return onlyGroupWide(g.AuthInfo.GetTokenPermissions())
}

func (g groupWidePermissions) GetTokenDelegatedPermissions() []string {
	return onlyGroupWide(g.AuthInfo.GetTokenDelegatedPermissions())
}

func onlyGroupWide(permissions []string) []string {
	var out []string
	for _, p := range permissions {
		target, _, _ := strings.Cut(p, ":")
		if !strings.Contains(target, "/") {
			out = append(out, p)
		}
	}
	return out
}
