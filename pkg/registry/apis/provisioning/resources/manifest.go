package resources

import (
	"context"
	"slices"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"

	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// SupportedResourcesFunc returns the resources that provisioning supports at the time of the call.
type SupportedResourcesFunc func(ctx context.Context) []SupportedResource

// StaticSupportedResources returns a SupportedResourcesFunc that always returns supported.
func StaticSupportedResources(supported ...SupportedResource) SupportedResourcesFunc {
	return func(context.Context) []SupportedResource { return supported }
}

// ManifestSupportedResources returns supported plus each kind that a published app manifest
// opts in to provisioning. Entries in supported take precedence over the manifests.
func ManifestSupportedResources(manifests resource.ManifestDiscovery, supported []SupportedResource) SupportedResourcesFunc {
	if manifests == nil {
		return StaticSupportedResources(supported...)
	}
	return func(ctx context.Context) []SupportedResource {
		list, err := manifests.ListManifests(ctx)
		if err != nil {
			logging.FromContext(ctx).Warn("failed to list app manifests for provisioning", "error", err)
			return supported
		}
		return mergeManifestResources(supported, list.Items)
	}
}

func mergeManifestResources(supported []SupportedResource, manifests []appmanifestv1alpha2.AppManifest) []SupportedResource {
	out := slices.Clone(supported)
	index := make(map[schema.GroupKind]int, len(out))
	for i, r := range out {
		index[r.GroupKind] = i
	}
	for _, manifest := range manifests {
		data, err := manifest.Spec.ToManifestData()
		if err != nil {
			continue
		}
		for _, version := range data.Versions {
			for _, kind := range version.Kinds {
				gk := schema.GroupKind{Group: data.Group, Kind: kind.Kind}
				i, ok := index[gk]
				if !ok {
					if !kind.IsProvisionable() {
						continue
					}
					caps := sets.New[string]()
					if kind.Scope != "Cluster" && (kind.FolderScoped == nil || *kind.FolderScoped) {
						caps.Insert(CapabilityFolder)
					}
					out = append(out, SupportedResource{GroupKind: gk, Capabilities: caps})
					i = len(out) - 1
					index[gk] = i
				}
				if out[i].Resource == "" {
					out[i].Resource = kind.Resource()
					out[i].UI = kind.UI
				}
			}
		}
	}
	return out
}
