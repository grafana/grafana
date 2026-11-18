package patscope

import (
	"maps"
	"slices"
	"sync"
	"time"
)

// Grants are the effective limits of a personal access token. They are handed to
// in-process authorization clients, which only see the signed ID token of the
// token's owner and would otherwise authorize with the owner's full permissions.
type Grants struct {
	Permissions    map[string][]string
	ResourceScoped bool
}

type grantEntry struct {
	grants  Grants
	expires time.Time
}

var (
	grantsMu    sync.Mutex
	grantsStore = map[string]grantEntry{}
	grantsNow   = time.Now
)

// RememberGrants stores the grants for a signed ID token until it expires.
// The store is process-local on purpose: a remote consumer cannot look the
// token up and therefore fails closed.
func RememberGrants(idToken string, g Grants, expires time.Time) {
	if idToken == "" {
		return
	}
	now := grantsNow()
	perms := make(map[string][]string, len(g.Permissions))
	for k, v := range g.Permissions {
		perms[k] = slices.Clone(v)
	}
	g.Permissions = perms

	grantsMu.Lock()
	defer grantsMu.Unlock()
	for k, e := range grantsStore {
		if !e.expires.After(now) {
			delete(grantsStore, k)
		}
	}
	grantsStore[idToken] = grantEntry{grants: g, expires: expires}
}

// LookupGrants returns the grants remembered for an ID token.
func LookupGrants(idToken string) (Grants, bool) {
	grantsMu.Lock()
	defer grantsMu.Unlock()
	e, ok := grantsStore[idToken]
	if !ok || !e.expires.After(grantsNow()) {
		return Grants{}, false
	}
	g := e.grants
	g.Permissions = maps.Clone(g.Permissions)
	return g, true
}
