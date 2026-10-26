package resource

import (
	"slices"
	"sync"

	"github.com/grafana/grafana-app-sdk/app"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// HybridSearchConfigRegistry tracks manifest opt-in independently of index
// rebuilds, so disabling hybrid search does not wait for an index update.
type HybridSearchConfigRegistry struct {
	mu      sync.RWMutex
	configs map[schema.GroupResource]hybridSearchConfig
}

type hybridSearchConfig struct {
	enabled bool
	kind    string
}

func NewHybridSearchConfigRegistry(manifests []*app.ManifestData) *HybridSearchConfigRegistry {
	r := &HybridSearchConfigRegistry{}
	r.Reload(manifests)
	return r
}

func (r *HybridSearchConfigRegistry) Enabled(group, resource string) bool {
	return r.lookup(group, resource).enabled
}

func (r *HybridSearchConfigRegistry) lookup(group, resource string) hybridSearchConfig {
	if r == nil {
		return hybridSearchConfig{}
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.configs[schema.GroupResource{Group: group, Resource: resource}]
}

// Reload replaces the snapshot, with later sources and the first manifest
// within each source winning. A winning resource's absent or false declarations
// also override older versions, even when it declares no search fields.
func (r *HybridSearchConfigRegistry) Reload(sources ...[]*app.ManifestData) {
	configs := make(map[schema.GroupResource]hybridSearchConfig)
	for _, source := range slices.Backward(sources) {
		for _, manifest := range source {
			if manifest == nil {
				continue
			}
			declared := make(map[schema.GroupResource]hybridSearchConfig)
			for _, version := range manifest.Versions {
				for _, kind := range version.Kinds {
					key := schema.GroupResource{Group: manifest.Group, Resource: ManifestResourceName(kind)}
					config := declared[key]
					if config.kind == "" {
						config.kind = kind.Kind
					}
					if !config.enabled && version.Served && kind.Scope == "Namespaced" && kind.HasHybridEndpoint() {
						config = hybridSearchConfig{enabled: true, kind: kind.Kind}
					}
					declared[key] = config
				}
			}
			for key, config := range declared {
				if _, claimed := configs[key]; !claimed {
					configs[key] = config
				}
			}
		}
	}
	r.mu.Lock()
	r.configs = configs
	r.mu.Unlock()
}
