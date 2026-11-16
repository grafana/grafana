package resources

import (
	"context"
	"slices"
	"sync/atomic"
	"time"

	"github.com/grafana/dskit/services"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"

	"github.com/grafana/grafana-app-sdk/app"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// SupportedResourcesFunc returns the resources that provisioning supports at the time of the call.
type SupportedResourcesFunc func(ctx context.Context) []SupportedResource

// StaticSupportedResources returns a SupportedResourcesFunc that always returns supported.
func StaticSupportedResources(supported ...SupportedResource) SupportedResourcesFunc {
	return func(context.Context) []SupportedResource { return supported }
}

// ManifestSupportedResources returns supported plus each kind that a published app manifest
// opts in to provisioning, and the callback that a resource.ManifestWatcher calls with the
// manifests. Entries in supported take precedence over the manifests.
func ManifestSupportedResources(supported []SupportedResource) (SupportedResourcesFunc, func([]*app.ManifestData)) {
	var merged atomic.Pointer[[]SupportedResource]
	merged.Store(&supported)
	return func(context.Context) []SupportedResource { return *merged.Load() }, func(manifests []*app.ManifestData) {
		out := mergeManifestResources(supported, manifests)
		merged.Store(&out)
	}
}

// RemoteManifestSupportedResources is ManifestSupportedResources with the service that watches
// the manifests the router publishes at cfg.DiscoveryURL. Without a URL, the set is supported.
func RemoteManifestSupportedResources(supported []SupportedResource, cfg resource.ManifestWatcherConfig) (SupportedResourcesFunc, services.Service, error) {
	if cfg.DiscoveryURL == "" {
		return StaticSupportedResources(supported...), services.NewIdleService(nil, nil), nil
	}
	fn, onChange := ManifestSupportedResources(supported)
	cfg.DiscoveryAudience = resource.ManifestDiscoveryGVR.Group
	cfg.PollInterval = time.Minute
	cfg.Log = log.New("provisioning-manifest-watcher")
	watcher, err := resource.NewManifestWatcher(cfg, nil, onChange)
	return fn, watcher, err
}

func mergeManifestResources(supported []SupportedResource, manifests []*app.ManifestData) []SupportedResource {
	out := slices.Clone(defaultSupportedResources(supported))
	seen := sets.New[schema.GroupKind]()
	for _, r := range out {
		seen.Insert(r.GroupKind)
	}
	for _, data := range manifests {
		for _, version := range data.Versions {
			for _, kind := range version.Kinds {
				gk := schema.GroupKind{Group: data.Group, Kind: kind.Kind}
				if seen.Has(gk) || !kind.IsProvisionable() || kind.Scope == "Cluster" || storingCollection(supported, gk) != "" {
					continue
				}
				caps := sets.New[string]()
				if kind.FolderScoped == nil || *kind.FolderScoped {
					caps.Insert(CapabilityFolder)
				}
				out = append(out, SupportedResource{GroupKind: gk, Capabilities: caps})
				seen.Insert(gk)
			}
		}
	}
	return out
}
