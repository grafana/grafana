package resources

import (
	"slices"
	"sync/atomic"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
)

// SupportedResourceSet is the set of resources that provisioning supports: the configured ones,
// plus the kinds that a source such as the app manifests adds while the process runs.
type SupportedResourceSet interface {
	// Get returns the set at the time of the call.
	Get() []SupportedResource
	// Update replaces the kinds that the source added. A configured resource, or a configured
	// collection that covers a kind, takes precedence over the kind.
	Update(kinds []SupportedResource)
	// Configured returns the configured resources. They do not change.
	Configured() []SupportedResource
	// Added returns the kinds that the source added.
	Added() []SupportedResource
}

func NewSupportedResourceSet(configured []SupportedResource) SupportedResourceSet {
	return &supportedResourceSet{configured: configured}
}

type supportedResourceSet struct {
	configured []SupportedResource
	added      atomic.Pointer[[]SupportedResource]
}

func (s *supportedResourceSet) Get() []SupportedResource {
	added := s.Added()
	if len(added) == 0 {
		return s.configured
	}
	return append(slices.Clip(defaultSupportedResources(s.configured)), added...)
}

func (s *supportedResourceSet) Update(kinds []SupportedResource) {
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

func (s *supportedResourceSet) Configured() []SupportedResource { return s.configured }

func (s *supportedResourceSet) Added() []SupportedResource {
	if added := s.added.Load(); added != nil {
		return *added
	}
	return nil
}
