package resources

import (
	"context"
	"fmt"
	"slices"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"
	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// manifestCacheTTL is how long a merged set is reused before the manifests are read again.
// TODO: polling keeps manifest state in provisioning. Replace it with a shared mechanism that
// notifies consumers of manifest changes, once the router or the app platform offers one.
const manifestCacheTTL = 30 * time.Second

// SupportedResourcesFunc returns the resources that provisioning supports at the time of the call.
type SupportedResourcesFunc func(ctx context.Context) []SupportedResource

// StaticSupportedResources returns a SupportedResourcesFunc that always returns supported.
func StaticSupportedResources(supported ...SupportedResource) SupportedResourcesFunc {
	return func(context.Context) []SupportedResource { return supported }
}

// ManifestLister lists the published app manifests. The router implements it in process,
// and NewRemoteManifestLister implements it over HTTP.
//
//go:generate mockery --name ManifestLister --structname MockManifestLister --inpackage --filename manifest_lister_mock.go --with-expecter
type ManifestLister interface {
	ListManifests(ctx context.Context) (*appmanifestv1alpha2.AppManifestList, error)
}

// NewRemoteManifestLister reads the manifests that the router publishes at
// /apis/discovery/v1alpha2/manifests. cfg must authenticate against the router.
func NewRemoteManifestLister(cfg *rest.Config) (ManifestLister, error) {
	client, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("create manifest discovery client: %w", err)
	}
	return &remoteManifestLister{client: client}, nil
}

type remoteManifestLister struct {
	client dynamic.Interface
}

func (l *remoteManifestLister) ListManifests(ctx context.Context) (*appmanifestv1alpha2.AppManifestList, error) {
	list, err := l.client.Resource(resource.ManifestDiscoveryGVR).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list app manifests: %w", err)
	}
	out := &appmanifestv1alpha2.AppManifestList{Items: make([]appmanifestv1alpha2.AppManifest, len(list.Items))}
	for i := range list.Items {
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(list.Items[i].Object, &out.Items[i]); err != nil {
			return nil, fmt.Errorf("decode app manifest %q: %w", list.Items[i].GetName(), err)
		}
	}
	return out, nil
}

// ManifestSupportedResources returns supported plus each kind that a published app manifest
// opts in to provisioning. Entries in supported take precedence over the manifests. The merged
// set is reused for manifestCacheTTL; when the manifests cannot be read, the last set is kept.
func ManifestSupportedResources(manifests ManifestLister, supported []SupportedResource) SupportedResourcesFunc {
	if manifests == nil {
		return StaticSupportedResources(supported...)
	}
	var (
		mu      sync.Mutex
		merged  = supported
		fetched time.Time
	)
	return func(ctx context.Context) []SupportedResource {
		mu.Lock()
		defer mu.Unlock()
		if time.Since(fetched) < manifestCacheTTL {
			return merged
		}
		fetched = time.Now()
		list, err := manifests.ListManifests(ctx)
		if err != nil {
			logging.FromContext(ctx).Warn("failed to list app manifests for provisioning", "error", err)
			return merged
		}
		merged = mergeManifestResources(supported, list.Items)
		return merged
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
