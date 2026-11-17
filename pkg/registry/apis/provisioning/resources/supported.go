package resources

import (
	"context"
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
	added := s.added.Load()
	if added == nil || len(*added) == 0 {
		return s.configured
	}
	return append(slices.Clip(defaultSupportedResources(s.configured)), *added...)
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

// Clients wraps factory so that its clients also support the added kinds. The factory does not
// run discovery again, so an update cannot break the clients of the configured resources.
func (s *SupportedResourceSet) Clients(factory ClientFactory) ClientFactory {
	return &supportedSetClientFactory{ClientFactory: factory, set: s}
}

type supportedSetClientFactory struct {
	ClientFactory
	set *SupportedResourceSet
}

func (f *supportedSetClientFactory) Clients(ctx context.Context, namespace string) (ResourceClients, error) {
	clients, err := f.ClientFactory.Clients(ctx, namespace)
	if err != nil {
		return nil, err
	}
	supported := clients.SupportedResources()
	if added := f.set.added.Load(); added != nil {
		supported = append(slices.Clip(supported), *added...)
	}
	return &supportedSetClients{ResourceClients: clients, supported: supported}, nil
}

type supportedSetClients struct {
	ResourceClients
	supported []SupportedResource
}

func (c *supportedSetClients) SupportedResources() []SupportedResource { return c.supported }
