package accesscontrol

import (
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func Checker(user identity.Requester, action string) func(scopes ...string) bool {
	permissions := user.GetPermissions()
	userScopes, ok := permissions[action]
	if !ok {
		return func(scopes ...string) bool { return false }
	}

	lookup := make(map[string]bool, len(userScopes))
	for i := range userScopes {
		lookup[userScopes[i]] = true
	}

	var checkedWildcards bool
	var hasWildcard bool

	return func(scopes ...string) bool {
		if !checkedWildcards {
			wildcards := wildcardsFromScopes(scopes...)
			for _, w := range wildcards {
				if _, ok := lookup[w]; ok {
					hasWildcard = true
					break
				}
			}
			checkedWildcards = true
		}

		if hasWildcard {
			return true
		}

		for _, s := range scopes {
			if lookup[s] {
				return true
			}
		}
		return false
	}
}

func wildcardsFromScopes(scopes ...string) Wildcards {
	prefixes := make([]string, 0, len(scopes))
	for _, scope := range scopes {
		prefixes = append(prefixes, ScopePrefix(scope))
	}

	return WildcardsFromPrefixes(prefixes)
}
