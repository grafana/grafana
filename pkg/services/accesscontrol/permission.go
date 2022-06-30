package accesscontrol

import (
	"strings"
)

// ReducePermissions takes a sorted slice of permissions and removes all permission for an action if there is a wildcard scope
func ReducePermissions(permissions []Permission) []Permission {
	var out []Permission
	wildcards := make(map[string]string)
	for _, p := range permissions {
		prefix, ok := wildcards[p.Action]
		if ok && strings.HasPrefix(p.Scope, prefix) {
			continue
		}

		prefix, last := p.Scope[:len(p.Scope)-1], p.Scope[len(p.Scope)-1]
		if last == '*' {
			wildcards[p.Action] = prefix
		}
		out = append(out, p)
	}
	return out
}
