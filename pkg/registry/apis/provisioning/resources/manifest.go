package resources

import (
	"context"
	"fmt"
	"slices"
	"sync/atomic"

	"github.com/grafana/dskit/services"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana-app-sdk/app"
	appmanifestv1alpha2 "github.com/grafana/grafana-app-sdk/app/appmanifest/v1alpha2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

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
// /apis/discovery/v1alpha2/manifests, with the config that configProvider returns. The router
// accepts a token for the resource.ManifestDiscoveryGVR group on that path.
func NewRemoteManifestLister(configProvider apiserver.RestConfigProvider) ManifestLister {
	return &remoteManifestLister{configProvider: configProvider}
}

type remoteManifestLister struct {
	configProvider apiserver.RestConfigProvider
}

func (l *remoteManifestLister) ListManifests(ctx context.Context) (*appmanifestv1alpha2.AppManifestList, error) {
	cfg, err := l.configProvider.GetRestConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("get manifest discovery config: %w", err)
	}
	client, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("create manifest discovery client: %w", err)
	}
	list, err := client.Resource(resource.ManifestDiscoveryGVR).List(ctx, metav1.ListOptions{})
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

type manifestDiscovery struct{ ManifestLister }

func (manifestDiscovery) GetManifest(context.Context, string) (*appmanifestv1alpha2.AppManifest, error) {
	return nil, apierrors.NewMethodNotSupported(resource.ManifestDiscoveryGVR.GroupResource(), "get")
}

// ManifestSupportedResources returns supported plus each kind that a published app manifest
// opts in to provisioning, and the service that watches the manifests. Entries in supported
// take precedence over the manifests. The set is supported until the service lists the
// manifests; when the manifests cannot be read or none are listed, the last set is kept.
func ManifestSupportedResources(manifests ManifestLister, supported []SupportedResource) (SupportedResourcesFunc, services.Service) {
	if manifests == nil {
		return StaticSupportedResources(supported...), services.NewIdleService(nil, nil)
	}
	var merged atomic.Pointer[[]SupportedResource]
	merged.Store(&supported)
	watcher := resource.NewLocalManifestWatcher(manifestDiscovery{manifests}, nil, func(data []*app.ManifestData) {
		out := mergeManifestResources(supported, data)
		merged.Store(&out)
	}, log.New("provisioning-manifest-watcher"))
	return func(context.Context) []SupportedResource { return *merged.Load() }, watcher
}

func mergeManifestResources(supported []SupportedResource, manifests []*app.ManifestData) []SupportedResource {
	out := slices.Clone(supported)
	seen := sets.New[schema.GroupKind]()
	for _, r := range out {
		seen.Insert(r.GroupKind)
	}
	for _, data := range manifests {
		for _, version := range data.Versions {
			for _, kind := range version.Kinds {
				gk := schema.GroupKind{Group: data.Group, Kind: kind.Kind}
				if seen.Has(gk) || !kind.IsProvisionable() {
					continue
				}
				caps := sets.New[string]()
				if kind.Scope != "Cluster" && (kind.FolderScoped == nil || *kind.FolderScoped) {
					caps.Insert(CapabilityFolder)
				}
				out = append(out, SupportedResource{GroupKind: gk, Capabilities: caps})
				seen.Insert(gk)
			}
		}
	}
	return out
}
