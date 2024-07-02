package authz

import (
	"strings"

	authzlib "github.com/grafana/authlib/authz"
)

var (
	noAccessChecker   authzlib.Checker = func(resources ...authzlib.Resource) bool { return false }
	fullAccessChecker authzlib.Checker = func(resources ...authzlib.Resource) bool { return true }
)

// compileChecker generates a function to check whether the user has access to any scope of a given list of scopes.
func compileChecker(objects []string, kinds ...string) authzlib.Checker {
	// no permissions => no access to any resource of this type
	if len(objects) == 0 {
		return noAccessChecker
	}

	// TODO: double check
	// no prefix expected => only check for the action
	if len(kinds) == 0 {
		return fullAccessChecker
	}

	isWildcard := wildcardDetector(kinds...)
	lookup := make(map[string]bool, len(objects))
	for _, s := range objects {
		// one scope is a wildcard => access to all resources of this type
		if isWildcard(s) {
			return fullAccessChecker
		}
		lookup[s] = true
	}

	return func(resources ...authzlib.Resource) bool {
		// search for any direct match
		for i := range resources {
			if lookup[resources[i].Scope()] {
				return true
			}
		}
		return false
	}
}

// wildcardDetector is an helper to quickly assess if a scope is a wildcard of a given set of kinds.
// ex: wildcardDetector("datasources", "folders")("datasources:uid:*") => true
func wildcardDetector(kinds ...string) func(scope string) bool {
	// no kinds => no wildcard
	if len(kinds) == 0 {
		return func(scope string) bool { return false }
	}
	return func(scope string) bool {
		// split the scope into its parts
		kind, _, id := splitScope(scope)
		for i := range kinds {
			if (kind == kinds[i] || kind == "*") && id == "*" {
				return true
			}
		}
		return false
	}
}

// splitScope returns kind, attribute and Identifier
func splitScope(scope string) (kind string, attribute string, id string) {
	fragments := strings.Split(scope, ":")
	switch l := len(fragments); l {
	case 1: // Splitting a wildcard scope "*" -> kind: "*"; attribute: "*"; identifier: "*"
		return fragments[0], fragments[0], fragments[0]
	case 2: // Splitting a wildcard scope with specified kind "dashboards:*" -> kind: "dashboards"; attribute: "*"; identifier: "*"
		return fragments[0], fragments[1], fragments[1]
	default: // Splitting a scope with all fields specified "dashboards:uid:my_dash" -> kind: "dashboards"; attribute: "uid"; identifier: "my_dash"
		return fragments[0], fragments[1], strings.Join(fragments[2:], ":")
	}
}
