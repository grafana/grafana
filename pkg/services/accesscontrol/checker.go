package accesscontrol

import (
	"strings"

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

	lookup := make(map[string]bool, len(userScopes)-1)
	for i := range userScopes {
		lookup[userScopes[i]] = true
	}

	var cached bool
	var hasWildcard bool

	return func(scopes ...string) bool {
		if !cached {
			wildcards := wildcardsFromScopes(scopes...)
			for _, w := range wildcards {
				if _, ok := lookup[w]; ok {
					hasWildcard = true
					break
				}
			}
			cached = true
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

	return WildcardsFromPrefixes(prefixes...)
}

// WildcardsFromPrefixes generates valid wildcards from prefix
// datasource:uid: => "*", "datasource:*", "datasource:uid:*"
func WildcardsFromPrefixes(prefixes ...string) Wildcards {
	var b strings.Builder
	wildcards := Wildcards{"*"}
	for _, prefix := range prefixes {
		parts := strings.Split(prefix, ":")
		for _, p := range parts {
			if p == "" {
				continue
			}
			b.WriteString(p)
			b.WriteRune(':')
			wildcards = append(wildcards, b.String()+"*")
		}
		b.Reset()
	}
	return wildcards
}
