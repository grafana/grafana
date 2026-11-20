package registry

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
)

// nowFunc is the clock used to stamp retained builds. It is a package var so the
// retained-build GC (F1-T4) age logic can be exercised deterministically in tests.
var nowFunc = time.Now

// SetNowForTest overrides the retained-build clock and returns the previous value
// so callers can restore it. It exists to stamp builds at deterministic times in
// tests of the retained-build GC.
func SetNowForTest(fn func() time.Time) func() time.Time {
	prev := nowFunc
	nowFunc = fn
	return prev
}

// defaultMaxRetainedBuilds is the number of builds retained per plugin (active +
// superseded) before the oldest retained build is evicted. Retention is
// metadata-only: the registry holds *plugins.Plugin pointers whose bytes remain on
// the per-pod FS layout (<plugins_path>/<id>/.builds/<buildHash>/), so retaining a
// build adds map-entry overhead only (NFR-3).
const defaultMaxRetainedBuilds = 3

// retainedBuild pairs a registered build with its insertion order so the oldest
// entry can be evicted once a plugin exceeds maxRetainedBuilds.
type retainedBuild struct {
	plugin *plugins.Plugin
	seq    uint64
	// stampedAt is the wall-clock registration time, the recency stamp the
	// retained-build GC (F1-T4) uses to compute a build's age against the
	// retention window. It is preserved across in-place re-registration.
	stampedAt time.Time
}

// RetainedBuildInfo is the GC-facing view of a retained build: the buildHash (the
// RemoveBuild key) and its registration time. It is the read seam the F1-T4 GC
// consumes so eviction still routes through RemoveBuild.
type RetainedBuildInfo struct {
	BuildHash    string
	RegisteredAt time.Time
}

// AddBuild retains a build for a plugin under its buildHash. The buildHash is the
// content digest from pluginassets/modulehash (F1-T1); the registry keys on the
// value and does not compute it. Registering an existing buildHash replaces the
// stored build. When a plugin exceeds maxRetainedBuilds, the oldest retained build
// is evicted (metadata only — on-disk bytes are unaffected).
func (i *InMemory) AddBuild(_ context.Context, buildHash string, p *plugins.Plugin) error {
	if buildHash == "" {
		return fmt.Errorf("cannot retain build for plugin %s: empty buildHash", p.ID)
	}
	if p == nil {
		return fmt.Errorf("cannot retain nil build for buildHash %s", buildHash)
	}

	i.mu.Lock()
	defer i.mu.Unlock()

	byHash, ok := i.builds[p.ID]
	if !ok {
		byHash = make(map[string]*retainedBuild)
		i.builds[p.ID] = byHash
	}

	// If this is the plugin's active build — the same pointer the registry stored
	// via Add, as opposed to a synthetic seeded build — pin its hash so capacity
	// eviction never removes it. Without this the active build (retained first, so
	// lowest-seq) is the first eviction victim once enough seeds load, and a
	// build-addressed request for the live build would 410 while it is still active.
	if active, ok := i.store[p.ID]; ok && active == p {
		i.activeHash[p.ID] = buildHash
	}

	if existing, ok := byHash[buildHash]; ok {
		// Replace in place, preserving recency so a re-register does not reset age.
		existing.plugin = p
		return nil
	}

	i.buildSeq++
	byHash[buildHash] = &retainedBuild{plugin: p, seq: i.buildSeq, stampedAt: nowFunc()}

	i.evictOldestLocked(p.ID)
	return nil
}

// Build resolves a retained build by (pluginID, buildHash). An empty buildHash
// falls back to the active build so existing callers keep working unchanged.
func (i *InMemory) Build(ctx context.Context, pluginID, buildHash string) (*plugins.Plugin, bool) {
	if buildHash == "" {
		return i.plugin(pluginID)
	}

	i.mu.RLock()
	defer i.mu.RUnlock()

	byHash, ok := i.builds[pluginID]
	if !ok {
		return nil, false
	}
	rb, ok := byHash[buildHash]
	if !ok {
		return nil, false
	}
	return rb.plugin, true
}

// Builds returns all retained builds for a plugin. Order is unspecified.
func (i *InMemory) Builds(_ context.Context, pluginID string) []*plugins.Plugin {
	i.mu.RLock()
	defer i.mu.RUnlock()

	byHash := i.builds[pluginID]
	res := make([]*plugins.Plugin, 0, len(byHash))
	for _, rb := range byHash {
		res = append(res, rb.plugin)
	}
	return res
}

// PluginIDsWithBuilds returns the IDs of plugins that currently have at least one
// retained build. It is a read seam for the retained-build GC (F1-T4).
func (i *InMemory) PluginIDsWithBuilds() []string {
	i.mu.RLock()
	defer i.mu.RUnlock()

	ids := make([]string, 0, len(i.builds))
	for id := range i.builds {
		ids = append(ids, id)
	}
	return ids
}

// RetainedBuildInfos returns the (buildHash, registeredAt) of every retained build
// for a plugin. It is the read seam the retained-build GC (F1-T4) pairs with
// RemoveBuild: the GC decides which hashes are stale/over-cap, then evicts each
// via RemoveBuild. Order is unspecified.
func (i *InMemory) RetainedBuildInfos(pluginID string) []RetainedBuildInfo {
	i.mu.RLock()
	defer i.mu.RUnlock()

	byHash := i.builds[pluginID]
	res := make([]RetainedBuildInfo, 0, len(byHash))
	for hash, rb := range byHash {
		res = append(res, RetainedBuildInfo{BuildHash: hash, RegisteredAt: rb.stampedAt})
	}
	return res
}

// RemoveBuild drops a single retained build. It is the eviction seam consumed by
// the retained-build GC (F1-T4).
func (i *InMemory) RemoveBuild(_ context.Context, pluginID, buildHash string) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	byHash, ok := i.builds[pluginID]
	if !ok {
		return fmt.Errorf("plugin %s has no retained builds", pluginID)
	}
	if _, ok := byHash[buildHash]; !ok {
		return fmt.Errorf("plugin %s has no retained build %s", pluginID, buildHash)
	}
	delete(byHash, buildHash)
	if i.activeHash[pluginID] == buildHash {
		delete(i.activeHash, pluginID)
	}
	if len(byHash) == 0 {
		delete(i.builds, pluginID)
	}
	return nil
}

// SetMaxRetainedBuilds sets the per-plugin retention capacity and immediately
// evicts the oldest builds of any plugin that now exceeds it. n must be >= 1.
func (i *InMemory) SetMaxRetainedBuilds(n int) error {
	if n < 1 {
		return fmt.Errorf("maxRetainedBuilds must be >= 1, got %d", n)
	}

	i.mu.Lock()
	defer i.mu.Unlock()

	i.maxRetainedBuilds = n
	for pluginID := range i.builds {
		i.evictOldestLocked(pluginID)
	}
	return nil
}

// evictOldestLocked trims a plugin's retained builds down to maxRetainedBuilds by
// repeatedly removing the lowest-seq (oldest) entry. Caller must hold i.mu.
func (i *InMemory) evictOldestLocked(pluginID string) {
	byHash := i.builds[pluginID]
	active := i.activeHash[pluginID]
	for len(byHash) > i.maxRetainedBuilds {
		var oldestHash string
		var oldestSeq uint64
		found := false
		for h, rb := range byHash {
			// Never evict the active build, even when it is the oldest entry.
			if h == active {
				continue
			}
			if !found || rb.seq < oldestSeq {
				oldestHash, oldestSeq, found = h, rb.seq, true
			}
		}
		if !found {
			// Only the pinned active build remains; nothing is evictable.
			break
		}
		delete(byHash, oldestHash)
	}
	if len(byHash) == 0 {
		delete(i.builds, pluginID)
	}
}
