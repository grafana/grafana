package resource

import (
	"slices"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"
)

// EmbeddingConfig supplies text inputs only; its fields do not enable filtering.
type EmbeddingConfig struct {
	ReembedVersion int
	Fields         []app.ManifestVersionKindEmbedField
}

// EmbeddingConfigRegistry replaces complete snapshots so fields and
// their resource's shared revision cannot come from different reloads.
type EmbeddingConfigRegistry struct {
	mu      sync.RWMutex
	configs map[schema.GroupVersionResource]EmbeddingConfig
}

func NewEmbeddingConfigRegistry(sources ...[]*app.ManifestData) *EmbeddingConfigRegistry {
	r := &EmbeddingConfigRegistry{}
	r.Reload(sources...)
	return r
}

// For requires the stored object's exact API version. An absent declaration
// returns false, while an explicitly empty field list returns true.
func (r *EmbeddingConfigRegistry) For(gvr schema.GroupVersionResource) (EmbeddingConfig, bool) {
	if gvr.Version == "" {
		return EmbeddingConfig{}, false
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	config, ok := r.configs[gvr]
	config.Fields = slices.Clone(config.Fields)
	return config, ok
}

// Reload uses increasing source priority, with the first manifest winning ties
// within a source. Ownership covers the entire resource, including versions the
// winner omits, so fields cannot inherit another source's re-embedding revision.
// The manifests have already been validated by the SDK.
func (r *EmbeddingConfigRegistry) Reload(sources ...[]*app.ManifestData) {
	configs := make(map[schema.GroupVersionResource]EmbeddingConfig)
	claimed := make(map[schema.GroupResource]bool)
	for _, source := range slices.Backward(sources) {
		for _, m := range source {
			if m == nil {
				continue
			}
			for resource, embed := range m.Embed {
				gr := schema.GroupResource{Group: m.Group, Resource: resource}
				if claimed[gr] {
					continue
				}
				for _, version := range m.Versions {
					for _, kind := range version.Kinds {
						if ManifestResourceName(kind) == resource && kind.Embed != nil {
							configs[gr.WithVersion(version.Name)] = EmbeddingConfig{
								ReembedVersion: embed.ReembedVersion,
								Fields:         slices.Clone(kind.Embed.Fields),
							}
						}
					}
				}
				claimed[gr] = true
			}
		}
	}
	r.mu.Lock()
	r.configs = configs
	r.mu.Unlock()
}
