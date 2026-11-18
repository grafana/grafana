// Package patscope computes the effective permissions of a personal access
// token: the owner's live permissions intersected with the token's scopes,
// minus a deny-list of privilege-escalation and persistence actions.
package patscope

import (
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"slices"
	"strings"
)

// ErrInvalidScopes is returned when requested scopes are malformed or exceed the owner's permissions.
var ErrInvalidScopes = errors.New("invalid token scopes")

// Scopes maps an RBAC action pattern (exact, or with '*' wildcards such as
// "*:read") to the resource scopes the token is limited to. An empty scope
// list means "every scope the owner has for that action".
type Scopes map[string][]string

// deniedActions can never be exercised by a token, whatever the owner is allowed
// to do, so that a leaked token cannot mint credentials or change who can sign in.
var deniedActions = []string{
	"users.tokens:*",
	"users:write", "users:create", "users:delete", "users:enable", "users:disable", "users:logout",
	"users.password:write", "users.authtoken:write", "users.permissions:write", "users.quotas:write",
	"org.users:add", "org.users:remove", "org.users:write",
	"serviceaccounts:write", "serviceaccounts:create", "serviceaccounts:delete", "serviceaccounts.permissions:write",
	"apikeys:create", "apikeys:delete",
	"settings:write",
	// Writes that keep access after a token is revoked: granting permissions or
	// roles, and creating or changing teams and orgs.
	"*.permissions:write", "roles:write", "roles:delete", "*.roles:add", "*.roles:remove", "*.roles:write",
	"teams:create", "teams:write", "teams:delete",
	"orgs:create", "orgs:write", "orgs:delete", "orgs.quotas:write",
	// Admin-level reads that expose other users, roles, server settings or sign-in
	// configuration. The current user's own data and org (orgs:read) stay readable.
	"users:read", "users.permissions:read", "users.roles:read", "teams.permissions:read", "teams.roles:read",
	"roles:read", "settings:read", "org.users:read", "ldap.*", "server.stats:read",
}

// IsDeniedAction reports whether the action is on the token deny-list.
func IsDeniedAction(action string) bool {
	return slices.ContainsFunc(deniedActions, func(p string) bool { return matchAction(p, action) })
}

// Effective returns the permissions a token is allowed to use. It never returns
// an action or scope that is not present in ownerPerms.
func Effective(ownerPerms map[string][]string, tokenScopes Scopes, allowAdminActions bool) map[string][]string {
	out := make(map[string][]string, len(ownerPerms))
	for action, ownerScopes := range ownerPerms {
		denied := IsDeniedAction(action)
		if !allowAdminActions && denied {
			continue
		}

		var granted []string
		matched := false
		for pattern, tokScopes := range tokenScopes {
			if !matchAction(pattern, action) {
				continue
			}
			// Globs never grant deny-listed actions, so a wildcard token created before
			// allow_admin_actions was enabled gains no admin rights when it is switched on.
			if denied && pattern != action {
				continue
			}
			res := intersectScopes(ownerScopes, tokScopes)
			// A token narrowed to resources the owner has no access to for this action must
			// not keep the action at all: an empty scope list would read as "every scope".
			if len(nonEmpty(tokScopes)) > 0 && len(nonEmpty(ownerScopes)) > 0 && len(res) == 0 {
				continue
			}
			matched = true
			granted = append(granted, res...)
		}
		if !matched {
			continue
		}
		out[action] = dedupe(granted)
	}
	return out
}

// ValidateRequested checks scopes at creation time: every requested action
// pattern must match at least one action the owner currently holds.
func ValidateRequested(ownerPerms map[string][]string, requested Scopes, allowAdminActions bool) error {
	for pattern := range requested {
		if strings.TrimSpace(pattern) == "" {
			return fmt.Errorf("%w: empty action", ErrInvalidScopes)
		}
		if _, err := path.Match(pattern, ""); err != nil {
			return fmt.Errorf("%w: malformed action pattern", ErrInvalidScopes)
		}
		ok := false
		for action := range ownerPerms {
			if matchAction(pattern, action) && (allowAdminActions || !IsDeniedAction(action)) {
				ok = true
				break
			}
		}
		if !ok {
			return fmt.Errorf("%w: %q is not permitted for this user", ErrInvalidScopes, pattern)
		}
	}
	return nil
}

func matchAction(pattern, action string) bool {
	if pattern == action {
		return true
	}
	ok, err := path.Match(pattern, action)
	return err == nil && ok
}

// intersectScopes returns the scopes valid for both sets; the narrower scope wins.
func intersectScopes(owner, token []string) []string {
	owner, token = nonEmpty(owner), nonEmpty(token)
	if len(owner) == 0 {
		// action is not resource-scoped for the owner, nothing to narrow
		return nil
	}
	if len(token) == 0 {
		return owner
	}
	var res []string
	for _, o := range owner {
		for _, t := range token {
			switch {
			case covers(o, t):
				res = append(res, t)
			case covers(t, o):
				res = append(res, o)
			}
		}
	}
	return res
}

// covers reports whether scope a includes everything scope b does.
func covers(a, b string) bool {
	if a == b || a == "*" {
		return true
	}
	if prefix, ok := strings.CutSuffix(a, "*"); ok {
		return strings.HasPrefix(b, prefix)
	}
	return false
}

func nonEmpty(in []string) []string {
	return slices.DeleteFunc(slices.Clone(in), func(s string) bool { return s == "" })
}

func dedupe(in []string) []string {
	if len(in) == 0 {
		return []string{}
	}
	slices.Sort(in)
	return slices.Compact(in)
}

// Routes a token can never call, whatever the method: credential management,
// session control and account takeover vectors.
var deniedRoutePrefixes = []string{
	"/api/user/password", "/api/user/email", "/user/email", "/api/user/auth-tokens", "/api/user/revoke-auth-token",
	"/api/user/personal-access-tokens", "/api/user/tokens", "/api/personal-access-tokens", "/logout", "/api/logout", "/login",
}

// Routes where only writes are denied; reads stay governed by RBAC actions.
var deniedWriteRoutePrefixes = []string{
	"/api/playlists", "/api/short-urls", "/api/user", "/api/serviceaccounts", "/api/auth/keys", "/api/admin", "/api/orgs", "/api/org/users", "/api/org/settings", "/api/users", "/api/access-control", "/api/teams", "/api/org",
}

// Routes where reads are denied too: they list or look up other users, orgs and
// roles, or expose server and sign-in configuration.
var deniedReadRoutePrefixes = []string{
	"/api/admin", "/api/users", "/api/orgs", "/api/org/users", "/api/org/invites", "/api/ldap", "/api/saml",
	"/api/access-control/roles", "/api/access-control/users", "/api/access-control/teams", "/api/access-control/builtin-roles",
}

// IsDeniedRoute is the route-level guard for endpoints that are not (only) gated
// by RBAC actions. It is a defense-in-depth layer next to IsDeniedAction and
// accepts either a concrete request path or a route pattern.
func IsDeniedRoute(method, p string) bool {
	if hasAnyPrefix(p, deniedRoutePrefixes) {
		return true
	}
	if hasAnyPrefix(p, deniedReadRoutePrefixes) {
		return true
	}
	if method == "GET" || method == "HEAD" || method == "OPTIONS" {
		return false
	}
	if hasAnyPrefix(p, deniedWriteRoutePrefixes) {
		return true
	}
	// Permission and role assignment endpoints live under many resource families.
	return strings.Contains(p, "/permissions") || strings.Contains(p, "/roles")
}

// IsDeniedKubernetesPath reports whether the path is served by the k8s-style
// API server. Its authorizer evaluates the owner's stored permissions and does
// not see token-narrowed ones, so tokens are rejected there unconditionally,
// even when admin actions are allowed.
func IsDeniedKubernetesPath(p string) bool {
	return p == "/apis" || strings.HasPrefix(p, "/apis/") || p == "/openapi" || strings.HasPrefix(p, "/openapi/")
}

// adminRouteActions maps route families that are denied to tokens by default to
// the explicit token actions that lift the denial for that family only. Routes
// without an entry can never be lifted. Longest matching prefix wins.
var adminRouteActions = []struct {
	prefix      string
	read, write []string
}{
	{"/api/admin/settings", []string{"settings:read"}, nil},
	{"/api/admin/stats", []string{"server.stats:read"}, nil},
	{"/api/admin/users", []string{"users:read"}, []string{"users:write", "users:create", "users:delete", "users:enable", "users:disable", "users:logout", "users.password:write", "users.authtoken:write"}},
	{"/api/users", []string{"users:read"}, []string{"users:write", "users:create", "users:delete", "users:enable", "users:disable", "users:logout", "users.password:write", "users.authtoken:write"}},
	{"/api/orgs", nil, []string{"orgs:create", "orgs:write", "orgs:delete"}},
	{"/api/org/users", []string{"org.users:read"}, []string{"org.users:add", "org.users:remove", "org.users:write"}},
	{"/api/ldap", []string{"ldap.user:read", "ldap.status:read", "ldap.config:read"}, []string{"ldap.user:sync", "ldap.config:reload"}},
	{"/api/access-control/roles", []string{"roles:read"}, []string{"roles:write", "roles:delete"}},
	{"/api/access-control/users", []string{"users.roles:read", "users.permissions:read"}, []string{"users.roles:add", "users.roles:remove"}},
	{"/api/access-control/teams", []string{"teams.roles:read", "teams.permissions:read"}, []string{"teams.roles:add", "teams.roles:remove"}},
	{"/api/teams", nil, []string{"teams:create", "teams:write", "teams:delete"}},
	{"/api/serviceaccounts", nil, []string{"serviceaccounts:create", "serviceaccounts:write", "serviceaccounts:delete"}},
	{"/api/auth/keys", nil, []string{"apikeys:create", "apikeys:delete"}},
	{"/api/user/tokens", []string{"users.tokens:read"}, []string{"users.tokens:create", "users.tokens:delete"}},
	{"/api/user/password", nil, []string{"users.password:write"}},
	{"/api/user/auth-tokens", nil, []string{"users.authtoken:write"}},
	{"/api/org/settings", nil, []string{"orgs:write"}},
	{"/api/org", nil, []string{"orgs:write"}},
}

// RouteAllowed decides whether a token may call a route. Denied routes stay
// denied unless allowAdminActions is on AND the token explicitly holds an action
// that maps to that route family (only deny-listed actions are considered),
// so one admin scope does not open every denied route.
func RouteAllowed(method, p string, allowAdminActions bool, hasAction func(action string) bool) bool {
	if !IsDeniedRoute(method, p) {
		return true
	}
	if !allowAdminActions {
		return false
	}
	read := method == "GET" || method == "HEAD" || method == "OPTIONS"
	best := -1
	for i, r := range adminRouteActions {
		if strings.HasPrefix(p, r.prefix) && (best < 0 || len(r.prefix) > len(adminRouteActions[best].prefix)) {
			best = i
		}
	}
	var need []string
	if best >= 0 {
		need = adminRouteActions[best].write
		if read {
			need = adminRouteActions[best].read
		}
	}
	// Only deny-listed actions count: they are granted to a token solely when named
	// explicitly, so a wildcard token can never satisfy a mapping.
	return slices.ContainsFunc(need, func(a string) bool { return IsDeniedAction(a) && hasAction(a) })
}

// ExplicitAction reports whether the scopes name the action itself, not via a glob.
func ExplicitAction(s Scopes, action string) bool {
	_, ok := s[action]
	return ok
}

// IsResourceScoped reports whether any token scope narrows to specific resources
// (anything but a "<kind>:*" or "*" wildcard).
func IsResourceScoped(s Scopes) bool {
	for _, scopes := range s {
		for _, sc := range scopes {
			if sc != "*" && !(strings.HasSuffix(sc, ":*") && strings.Count(sc, ":") == 1) {
				return true
			}
		}
	}
	return false
}

func hasAnyPrefix(p string, prefixes []string) bool {
	return slices.ContainsFunc(prefixes, func(pre string) bool { return strings.HasPrefix(p, pre) })
}

// ParseStored decodes scopes persisted by the token service; malformed data yields no scopes.
func ParseStored(raw string) Scopes {
	out := Scopes{}
	if raw != "" {
		if err := json.Unmarshal([]byte(raw), &out); err != nil {
			return Scopes{}
		}
	}
	return out
}
