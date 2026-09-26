package router

import (
	"context"
	"net/http"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
	// deadlines holds the deadline of each fetch in progress, by fetch key.
	// Every caller of a fetch waits until that one deadline, not its own.
	deadlines map[string]time.Time
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

// fetchDeadline returns the deadline of the fetch for key, starting one if
// none is in progress.
func (c *discoveryCache) fetchDeadline(key string) time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	if deadline, ok := c.deadlines[key]; ok {
		return deadline
	}
	if c.deadlines == nil {
		c.deadlines = map[string]time.Time{}
	}
	deadline := time.Now().Add(discoveryFetchTimeout)
	c.deadlines[key] = deadline
	return deadline
}

func (c *discoveryCache) fetchDone(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.deadlines, key)
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
// is incomplete, or misses its deadline, the last cached copy is served with
// its versions marked stale.
//
// Callers wait only until the fetch's deadline. A backend handler that
// ignores its context can keep the fetch running forever; it is not
// restarted, since each restart would leave another goroutine stuck, and
// callers after the deadline return at once.
func (r *GrafanaRouter) groupDiscovery(req *http.Request, name string, entry servingEntry) apidiscoveryv2.APIGroupDiscovery {
	c := &r.discoveryCache
	if d, found, fresh := c.lookup(name, entry.key); found && fresh {
		return d
	}
	key := name + "\x00" + entry.key
	deadline := c.fetchDeadline(key)
	results := c.fetches.DoChan(key, func() (any, error) {
		defer c.fetchDone(key)
		// Shared by concurrent callers, so one caller leaving must not cancel it.
		ctx, cancel := context.WithDeadline(context.WithoutCancel(req.Context()), deadline)
		defer cancel()
		d, complete := backendDiscovery(req.WithContext(ctx), name, entry)
		if complete {
			c.store(name, entry.key, d)
		}
		return fetchedDiscovery{discovery: d, complete: complete}, nil
	})
	timer := time.NewTimer(time.Until(deadline))
	defer timer.Stop()
	var fetched fetchedDiscovery
	select {
	case result := <-results:
		fetched = result.Val.(fetchedDiscovery)
	case <-timer.C:
		fetched = fetchedDiscovery{discovery: unavailableDiscovery(name, entry)}
	}
	if !fetched.complete {
		if d, found, _ := c.lookup(name, entry.key); found {
			return staleDiscovery(d)
		}
	}
	return fetched.discovery
}

// unavailableDiscovery lists a group's versions, marked stale and without
// resources, for a backend whose discovery could not be read.
func unavailableDiscovery(name string, entry servingEntry) apidiscoveryv2.APIGroupDiscovery {
	group := apidiscoveryv2.APIGroupDiscovery{ObjectMeta: metav1.ObjectMeta{Name: name}}
	for _, gv := range entry.group.Versions {
		group.Versions = append(group.Versions, apidiscoveryv2.APIVersionDiscovery{
			Version: gv.Version, Freshness: apidiscoveryv2.DiscoveryFreshnessStale,
		})
	}
	return group
}

func staleDiscovery(d apidiscoveryv2.APIGroupDiscovery) apidiscoveryv2.APIGroupDiscovery {
	d.Versions = append([]apidiscoveryv2.APIVersionDiscovery(nil), d.Versions...)
	for i := range d.Versions {
		d.Versions[i].Freshness = apidiscoveryv2.DiscoveryFreshnessStale
	}
	return d
}
