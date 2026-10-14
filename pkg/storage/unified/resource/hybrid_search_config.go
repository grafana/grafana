package resource

import (
	"slices"
	"sync"

	"github.com/grafana/grafana-app-sdk/app"
)

// HybridSearchConfigRegistry tracks manifest opt-in independently of index
// rebuilds, so disabling hybrid search does not wait for an index update.
type HybridSearchConfigRegistry struct {
	mu      sync.RWMutex
	enabled map[LowerGroupResource]bool
}

func NewHybridSearchConfigRegistry(manifests []*app.ManifestData) *HybridSearchConfigRegistry {
	r := &HybridSearchConfigRegistry{}
	r.Reload(manifests)
	return r
}

func (r *HybridSearchConfigRegistry) Enabled(group, resource string) bool {
	if r == nil {
		return false
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.enabled[NewLowerGroupResource(group, resource)]
}

// Reload replaces the snapshot, with later sources and the first manifest
// within each source winning. A winning resource's absent or false declarations
// also override older versions, even when it declares no search fields.
func (r *HybridSearchConfigRegistry) Reload(sources ...[]*app.ManifestData) {
	enabled := make(map[LowerGroupResource]bool)
	for _, source := range slices.Backward(sources) {
		for _, manifest := range source {
			if manifest == nil {
				continue
			}
			declared := make(map[LowerGroupResource]bool)
			for _, version := range manifest.Versions {
				for _, kind := range version.Kinds {
					key := NewLowerGroupResource(manifest.Group, ManifestResourceName(kind))
					declared[key] = declared[key] || (version.Served && kind.Scope == "Namespaced" && kind.HasHybridEndpoint())
				}
			}
			for key, allow := range declared {
				if _, claimed := enabled[key]; !claimed {
					enabled[key] = allow
				}
			}
		}
	}
	r.mu.Lock()
	r.enabled = enabled
	r.mu.Unlock()
}
