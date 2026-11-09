package roleeffective

import (
	"fmt"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

// ActionScope is a minimal permission (action + scope) used for resolving effective permissions.
type ActionScope struct {
	Action string
	Scope  string
}

// DiffRolespecPermissions computes the difference between a base set of permissions and a desired set.
// Returns (added, omitted) where added contains permissions in desired but not in base,
// and omitted contains permissions in base but not in desired.
func DiffRolespecPermissions(base, desired []iamv0.RolespecPermission) (added, omitted []iamv0.RolespecPermission) {
	baseSet := make(map[iamv0.RolespecPermission]bool, len(base))
	for _, p := range base {
		baseSet[p] = true
	}
	desiredSet := make(map[iamv0.RolespecPermission]bool, len(desired))
	for _, p := range desired {
		desiredSet[p] = true
	}
	for p := range desiredSet {
		if !baseSet[p] {
			added = append(added, p)
		}
	}
	for _, p := range base {
		if !desiredSet[p] {
			omitted = append(omitted, p)
		}
	}
	return added, omitted
}

// ResolveEffective returns the effective permissions for a namespace Role: permissions from
// its RoleRefs, minus PermissionsOmitted, plus the role's own Permissions. This function does not
// validate role-reference policy; resolveRef receives each complete reference and resolves supported
// kinds or returns an error. If the role has no RoleRefs, hasRefs is false and the caller should use
// its own "own permissions only" path.
func ResolveEffective(
	role *iamv0.Role,
	resolveRef func(ref iamv0.RolespecRoleRef) ([]ActionScope, error),
) (effective []ActionScope, hasRefs bool, err error) {
	if len(role.Spec.RoleRefs) == 0 {
		return nil, false, nil
	}

	omitted := make(map[string]bool, len(role.Spec.PermissionsOmitted))
	for _, p := range role.Spec.PermissionsOmitted {
		omitted[p.Action+"|"+p.Scope] = true
	}

	effectiveMap := make(map[string]ActionScope)

	for _, roleRef := range role.Spec.RoleRefs {
		perms, err := resolveRef(roleRef)
		if err != nil {
			return nil, true, fmt.Errorf("role ref kind %q name %q: %w", roleRef.Kind, roleRef.Name, err)
		}
		for _, p := range perms {
			key := p.Action + "|" + p.Scope
			if !omitted[key] {
				effectiveMap[key] = p
			}
		}
	}

	for _, p := range role.Spec.Permissions {
		key := p.Action + "|" + p.Scope
		effectiveMap[key] = ActionScope{Action: p.Action, Scope: p.Scope}
	}

	effective = make([]ActionScope, 0, len(effectiveMap))
	for _, p := range effectiveMap {
		effective = append(effective, p)
	}
	return effective, true, nil
}
