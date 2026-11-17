package resources

import (
	"time"

	"github.com/grafana/dskit/services"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"

	"github.com/grafana/grafana-app-sdk/app"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// WatchManifests returns the service that adds to set each kind that a published app manifest
// opts in to provisioning. It reads the manifests from the router of this process, or from the
// router at cfg.DiscoveryURL. Without either, the service does nothing.
func WatchManifests(set *SupportedResourceSet, router resource.ManifestDiscovery, cfg resource.ManifestWatcherConfig) (services.Service, error) {
	onChange := func(manifests []*app.ManifestData) { set.Update(manifestKinds(manifests)) }
	switch {
	case router != nil:
		return resource.NewLocalManifestWatcher(router, nil, onChange, nil), nil
	case cfg.DiscoveryURL != "":
		cfg.DiscoveryAudience = provisioning.GROUP
		cfg.PollInterval = time.Minute
		cfg.Log = log.New("provisioning-manifest-watcher")
		return resource.NewManifestWatcher(cfg, nil, onChange)
	}
	return services.NewIdleService(nil, nil), nil
}

func manifestKinds(manifests []*app.ManifestData) []SupportedResource {
	var kinds []SupportedResource
	for _, data := range manifests {
		for _, version := range data.Versions {
			if !version.Served {
				continue
			}
			for _, kind := range version.Kinds {
				if !kind.IsProvisionable() || kind.Scope == "Cluster" {
					continue
				}
				caps := sets.New[string]()
				if kind.FolderScoped == nil || *kind.FolderScoped {
					caps.Insert(CapabilityFolder)
				}
				kinds = append(kinds, SupportedResource{GroupKind: schema.GroupKind{Group: data.Group, Kind: kind.Kind}, Capabilities: caps})
			}
		}
	}
	return kinds
}
