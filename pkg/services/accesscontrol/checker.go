package accesscontrol

import (
	"github.com/grafana/grafana/pkg/services/user"
)

func Checker(user *user.SignedInUser, action string) func(scopes ...string) bool {
	if user.Permissions == nil || user.Permissions[user.OrgID] == nil {
		return func(scopes ...string) bool { return false }
	}

	userScopes, ok := user.Permissions[user.OrgID][action]
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
	prefixes := make([]string, len(scopes))
	for _, scope := range scopes {
		prefixes = append(prefixes, ScopePrefix(scope))
	}

	return WildcardsFromPrefixes(prefixes)
}
