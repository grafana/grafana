// Package roleauth defines the authority needed to manage and delegate IAM roles.
package roleauth

import (
	"strings"

	"github.com/grafana/authlib/types"
)

const Group = "iam.grafana.app"

// DelegationChecks expands a legacy grant into every capability it conveys.
// Selectors are authorization queries, never persisted RoleBinding names.
func DelegationChecks(action, scope string) ([]types.CheckRequest, bool) {
	resource, names, verbs := "roles", []string{"*"}, []string{"create", "update"}
	prefix := "roles"
	switch action {
	case "roles:write":
	case "roles:delete":
		verbs = []string{"delete"}
	case "users.roles:add", "users.roles:remove":
		resource, prefix, names = "rolebindings", "users", []string{"user-*", "serviceaccount-*"}
		if action == "users.roles:remove" {
			verbs = []string{"delete"}
		}
	case "teams.roles:add", "teams.roles:remove":
		resource, prefix, names = "rolebindings", "teams", []string{"team-*"}
		if action == "teams.roles:remove" {
			verbs = []string{"delete"}
		}
	default:
		return nil, false
	}
	if scope != "permissions:type:delegate" && scope != "*" && scope != prefix+":*" && scope != prefix+":id:*" && scope != prefix+":uid:*" {
		return nil, false
	}
	var checks []types.CheckRequest
	for _, name := range names {
		for _, verb := range verbs {
			checks = append(checks, types.CheckRequest{Group: Group, Resource: resource, Verb: verb, Name: name})
		}
	}
	return checks, true
}

func IsBindingMutation(group, resource, subresource, verb string) bool {
	if group != Group || resource != "rolebindings" || subresource != "" {
		return false
	}
	switch verb {
	case "create", "update", "patch", "delete", "deletecollection":
		return true
	}
	return false
}

// BindingFamilies accepts canonical names and only the three exact selectors.
// An empty create is an API boundary probe; admission checks the actual body.
func BindingFamilies(name, verb string) (families []string, any bool) {
	if name == "" || name == "*" {
		return []string{"users", "teams"}, name == "" && verb == "create"
	}
	for _, prefix := range []string{"user-", "serviceaccount-", "team-"} {
		if !strings.HasPrefix(name, prefix) {
			continue
		}
		uid := strings.TrimPrefix(name, prefix)
		if uid == "" || (uid != "*" && strings.IndexFunc(uid, func(c rune) bool {
			return !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_' || c == '.')
		}) >= 0) {
			return nil, false
		}
		if prefix == "team-" {
			return []string{"teams"}, false
		}
		return []string{"users"}, false
	}
	return nil, false
}

// CheckBinding combines recipient decisions, requiring both for all-binding queries.
func CheckBinding(name, verb string, check func(string) (bool, error)) (bool, error) {
	families, any := BindingFamilies(name, verb)
	if len(families) == 0 {
		return false, nil
	}
	for _, family := range families {
		allowed, err := check(family)
		if err != nil {
			return false, err
		}
		if any && allowed {
			return true, nil
		}
		if !any && !allowed {
			return false, nil
		}
	}
	return !any, nil
}
