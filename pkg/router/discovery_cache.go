package router

import (
	"context"
	"net/http"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
)

const (
	// Bounds staleness for backends whose resources can change without a key
	// change, such as a forward backend redeployed with a new kind.
	discoveryCacheTTL = 5 * time.Minute
	// A slow backend must not stall discovery for every other group.
	discoveryFetchTimeout = 5 * time.Second
)

// discoveryCache holds aggregated discovery fetched from backends that are not
// DiscoveryProviders. Entries are shared across callers: like Kubernetes, the
// router does not filter discovery per caller. The router has no credentials
// of its own for these backends, so a miss is fetched with the caller's, and
// only a complete fetch is stored, so a caller who is refused never replaces
// a good entry.
type discoveryCache struct {
	mu      sync.Mutex
	entries map[string]discoveryCacheEntry // by group
	fetches singleflight.Group
}

type discoveryCacheEntry struct {
	key       string
	discovery apidiscoveryv2.APIGroupDiscovery
	expiresAt time.Time
}

type fetchedDiscovery struct {
	discovery apidiscoveryv2.APIGroupDiscovery
	complete  bool
}

func (c *discoveryCache) lookup(group, key string) (d apidiscoveryv2.APIGroupDiscovery, found, fresh bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[group]
	if !ok || entry.key != key {
		return apidiscoveryv2.APIGroupDiscovery{}, false, false
	}
	return entry.discovery, true, time.Now().Before(entry.expiresAt)
}

func (c *discoveryCache) store(group, key string, d apidiscoveryv2.APIGroupDiscovery) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.entries == nil {
		c.entries = map[string]discoveryCacheEntry{}
	}
	c.entries[group] = discoveryCacheEntry{key: key, discovery: d, expiresAt: time.Now().Add(discoveryCacheTTL)}
}

// retain drops entries for groups that are no longer served or whose backend changed.
func (c *discoveryCache) retain(snapshot map[string]servingEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for group, entry := range c.entries {
		if served, ok := snapshot[group]; !ok || served.key != entry.key {
			delete(c.entries, group)
		}
	}
}

// groupDiscovery returns a group's aggregated discovery: from the cache while
// fresh, otherwise from one fetch shared by concurrent callers. If that fetch
// is incomplete, the last cached copy is served with its versions marked stale.
func (r *GrafanaRouter) groupDiscovery(req *http.Request, name string, entry servingEntry) apidiscoveryv2.APIGroupDiscovery {
	c := &r.discoveryCache
	if d, found, fresh := c.lookup(name, entry.key); found && fresh {
		r.observeDiscovery(name, discoveryCached)
		return d
	}
	v, _, _ := c.fetches.Do(name+"\x00"+entry.key, func() (any, error) {
		// Shared by concurrent callers, so one caller leaving must not cancel it.
		ctx, cancel := context.WithTimeout(context.WithoutCancel(req.Context()), discoveryFetchTimeout)
		defer cancel()
		d, complete := backendDiscovery(req.WithContext(ctx), name, entry)
		if complete {
			c.store(name, entry.key, d)
		}
		return fetchedDiscovery{discovery: d, complete: complete}, nil
	})
	fetched := v.(fetchedDiscovery)
	switch {
	case fetched.complete:
		r.observeDiscovery(name, discoveryFetched)
	default:
		if d, found, _ := c.lookup(name, entry.key); found {
			r.observeDiscovery(name, discoveryStale)
			return staleDiscovery(d)
		}
		r.observeDiscovery(name, discoveryUnavailable)
	}
	return fetched.discovery
}

// How a group's aggregated discovery was obtained, for
// grafana_router_discovery_results_total.
const (
	discoveryProvided    = "provided"    // from a DiscoveryProvider, no request
	discoveryCached      = "cached"      // a fresh cache entry
	discoveryFetched     = "fetched"     // a complete fetch from the backend
	discoveryStale       = "stale"       // the last good copy, after a failed fetch
	discoveryUnavailable = "unavailable" // nothing to serve but the group's versions
)

func (r *GrafanaRouter) observeDiscovery(group, result string) {
	if r.onDiscovery != nil {
		r.onDiscovery(group, result)
	}
}

func staleDiscovery(d apidiscoveryv2.APIGroupDiscovery) apidiscoveryv2.APIGroupDiscovery {
	d.Versions = append([]apidiscoveryv2.APIVersionDiscovery(nil), d.Versions...)
	for i := range d.Versions {
		d.Versions[i].Freshness = apidiscoveryv2.DiscoveryFreshnessStale
	}
	return d
}
