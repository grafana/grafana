package resources

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"

	"github.com/grafana/grafana-app-sdk/app"
)

// ManifestKinds returns the callback of a resource.ManifestWatcher. It updates set with each
// kind that a published app manifest opts in to provisioning.
func ManifestKinds(set SupportedResourceSet) func([]*app.ManifestData) {
	return func(manifests []*app.ManifestData) {
		var kinds []SupportedResource
		for _, manifest := range manifests {
			for _, version := range manifest.Versions {
				for _, kind := range version.Kinds {
					if !version.Served || !kind.IsProvisionable() || kind.Scope == "Cluster" {
						continue
					}
					caps := sets.New[string]()
					if kind.FolderScoped == nil || *kind.FolderScoped {
						caps.Insert(CapabilityFolder)
					}
					kinds = append(kinds, SupportedResource{GroupKind: schema.GroupKind{Group: manifest.Group, Kind: kind.Kind}, Capabilities: caps})
				}
			}
		}
		set.Update(kinds)
	}
}
