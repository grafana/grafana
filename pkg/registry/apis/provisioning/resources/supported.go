package resources

import (
	"slices"
	"sync/atomic"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
)

// SupportedResourceProvider gives the resources that provisioning supports: the configured ones,
// plus the kinds that a source such as the app manifests adds while the process runs.
type SupportedResourceProvider interface {
	// Get returns the supported resources at the time of the call.
	Get() []SupportedResource
	// Update replaces the kinds that the source added. A configured resource, or a configured
	// collection that covers a kind, takes precedence over the kind.
	Update(kinds []SupportedResource)
	// Configured returns the configured resources. They do not change.
	Configured() []SupportedResource
	// Added returns the kinds that the source added.
	Added() []SupportedResource
}

func NewSupportedResourceProvider(configured []SupportedResource) SupportedResourceProvider {
	return &supportedResourceProvider{configured: configured}
}

type supportedResourceProvider struct {
	configured []SupportedResource
	added      atomic.Pointer[[]SupportedResource]
}

func (s *supportedResourceProvider) Get() []SupportedResource {
	added := s.Added()
	if len(added) == 0 {
		return s.configured
	}
	return append(slices.Clip(defaultSupportedResources(s.configured)), added...)
}

func (s *supportedResourceProvider) Update(kinds []SupportedResource) {
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

func (s *supportedResourceProvider) Configured() []SupportedResource { return s.configured }

func (s *supportedResourceProvider) Added() []SupportedResource {
	if added := s.added.Load(); added != nil {
		return *added
	}
	return nil
}
