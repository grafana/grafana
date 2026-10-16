package common

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// AuthorizeOrgCleanup requires an internal identity in the target tenant and
// explicit permission, rather than treating service identity as an RBAC bypass.
func AuthorizeOrgCleanup(ctx context.Context, namespace string, ac accesscontrol.AccessControl, permission accesscontrol.Evaluator) (bool, error) {
	if !identity.IsServiceIdentity(ctx) {
		return false, nil
	}
	u, err := identity.GetRequester(ctx)
	if err != nil {
		return false, err
	}
	ns, err := types.ParseNamespace(namespace)
	if err != nil || namespace == "" || namespace == "*" || ns.OrgID < 1 || ns.OrgID != u.GetOrgID() || !types.NamespaceMatches(u.GetNamespace(), namespace) {
		return false, fmt.Errorf("namespace does not match service identity tenant")
	}
	return ac.Evaluate(ctx, u, permission)
}
