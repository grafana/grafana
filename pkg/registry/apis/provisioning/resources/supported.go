package resources

import (
	"slices"
	"sync/atomic"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
)

// SupportedResourceSet is the set of resources that provisioning supports: the configured ones,
// plus the kinds that a source such as the app manifests adds while the process runs.
type SupportedResourceSet struct {
	configured []SupportedResource
	added      atomic.Pointer[[]SupportedResource]
}

func NewSupportedResourceSet(configured []SupportedResource) *SupportedResourceSet {
	return &SupportedResourceSet{configured: configured}
}

// Latest returns the set at the time of the call.
func (s *SupportedResourceSet) Latest() []SupportedResource {
	added := s.addedKinds()
	if len(added) == 0 {
		return s.configured
	}
	return append(slices.Clip(defaultSupportedResources(s.configured)), added...)
}

// Update replaces the kinds that the source added. A configured resource, or a configured
// collection that covers a kind, takes precedence over the kind.
func (s *SupportedResourceSet) Update(kinds []SupportedResource) {
	added := []SupportedResource{}
	seen := sets.New[schema.GroupKind]()
	for _, r := range defaultSupportedResources(s.configured) {
		seen.Insert(r.GroupKind)
	}
	for _, r := range kinds {
		if seen.Has(r.GroupKind) || storingCollection(s.configured, r.GroupKind) != "" {
			continue
		}
		added = append(added, r)
		seen.Insert(r.GroupKind)
	}
	s.added.Store(&added)
}

func (s *SupportedResourceSet) apply(o *clientFactoryOptions) { o.configured, o.set = s.configured, s }

func (s *SupportedResourceSet) addedKinds() []SupportedResource {
	if s == nil || s.added.Load() == nil {
		return nil
	}
	return *s.added.Load()
}
