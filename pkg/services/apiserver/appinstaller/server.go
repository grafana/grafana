package appinstaller

import (
	"context"
	"fmt"
	"strings"

	"github.com/emicklei/go-restful/v3"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	genericrest "k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serverstorage "k8s.io/apiserver/pkg/server/storage"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/logging"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	grafanaapiserveroptions "github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

var _ appsdkapiserver.GenericAPIServer = (*serverWrapper)(nil)

type serverWrapper struct {
	ctx               context.Context
	GenericAPIServer  appsdkapiserver.GenericAPIServer
	installer         appsdkapiserver.AppInstaller
	restOptionsGetter generic.RESTOptionsGetter
	storageOpts       *grafanaapiserveroptions.StorageOptions
	dualWriteService  dualwrite.Service
	builderMetrics    *builder.BuilderMetrics
	apiResourceConfig *serverstorage.ResourceConfig
}

func (s *serverWrapper) InstallAPIGroup(apiGroupInfo *genericapiserver.APIGroupInfo) error {
	group := s.installer.ManifestData().Group
	// Prune first so servedForResource and the installed storage see the same set.
	s.pruneDisabledResources(apiGroupInfo, group)
	servedForResource := servedVersionsForResource(apiGroupInfo, group)

	for v, storageMap := range apiGroupInfo.VersionedResourcesStorageMap {
		// Configure top-level resources before their subresources: a subresource inspects
		// its parent's configured storage, and map iteration order is non-deterministic.
		for _, subresource := range [...]bool{false, true} {
			for storagePath, restStorage := range storageMap {
				if isSubresourcePath(storagePath) != subresource {
					continue
				}
				if err := s.configureStoragePath(apiGroupInfo, v, storagePath, restStorage, servedForResource); err != nil {
					return err
				}
			}
		}
	}

	return s.GenericAPIServer.InstallAPIGroup(apiGroupInfo)
}

// isSubresourcePath reports whether a storage path addresses a subresource (e.g. "shorturls/status").
func isSubresourcePath(storagePath string) bool {
	return strings.Contains(storagePath, "/")
}

// pruneDisabledResources drops storage paths for GVRs disabled via apiResourceConfig. It is the
// single place resources are removed, keeping every later reader in sync with the installed set.
func (s *serverWrapper) pruneDisabledResources(apiGroupInfo *genericapiserver.APIGroupInfo, group string) {
	if s.apiResourceConfig == nil {
		return
	}
	log := logging.FromContext(s.ctx)
	for version, storageMap := range apiGroupInfo.VersionedResourcesStorageMap {
		for storagePath := range storageMap {
			gvr := schema.GroupVersionResource{Group: group, Version: version, Resource: resourceFromStoragePath(storagePath)}
			if !s.apiResourceConfig.ResourceEnabled(gvr) {
				log.Debug("Skipping storage for disabled resource", "gvr", gvr.String(), "storagePath", storagePath)
				delete(storageMap, storagePath)
			}
		}
	}
}

// servedVersionsForResource maps each resource to the group versions it is installed under.
func servedVersionsForResource(apiGroupInfo *genericapiserver.APIGroupInfo, group string) map[string][]schema.GroupVersion {
	served := make(map[string][]schema.GroupVersion)
	for version, storageMap := range apiGroupInfo.VersionedResourcesStorageMap {
		// Distinct resources within one version, deduping subresource paths that share a
		// resource (e.g. "dashboards" and "dashboards/dto" both count once).
		seen := make(map[string]struct{}, len(storageMap))
		for storagePath := range storageMap {
			resource := resourceFromStoragePath(storagePath)
			if _, ok := seen[resource]; ok {
				continue
			}
			seen[resource] = struct{}{}
			served[resource] = append(served[resource], schema.GroupVersion{Group: group, Version: version})
		}
	}
	return served
}

func (s *serverWrapper) configureStoragePath(
	apiGroupInfo *genericapiserver.APIGroupInfo,
	v string,
	storagePath string,
	restStorage genericrest.Storage,
	servedForResource map[string][]schema.GroupVersion,
) error {
	log := logging.FromContext(s.ctx)
	legacyProvider, dualWriteSupported := s.installer.(LegacyStorageProvider)
	gr := schema.GroupResource{
		Group:    s.installer.ManifestData().Group,
		Resource: resourceFromStoragePath(storagePath),
	}
	storage := s.configureStorage(gr, dualWriteSupported, restStorage)
	if dualWriteSupported {
		if unifiedStorage, ok := storage.(grafanarest.Storage); ok {
			log.Debug("Configuring dual writer for storage", "resource", gr.String(), "version", v, "storagePath", storagePath)
			key := gr.String()
			if resourceConfig, ok := s.storageOpts.UnifiedStorageConfig[key]; ok {
				s.builderMetrics.RecordDualWriterTargetMode(gr.Resource, gr.Group, resourceConfig.DualWriterMode)
			}
			legacyStorage := legacyProvider.GetLegacyStorage(gr.WithVersion(v))
			// unified must never serve an apiVersion the scheme never registered; with no
			// legacy fallback there is nothing safe to serve, so refuse to install.
			if err := s.dualWriteService.ValidateServedVersions(s.ctx, gr, servedForResource[gr.Resource]); err != nil {
				if legacyStorage == nil {
					return fmt.Errorf("cannot serve %q from unified storage: %w", gr.String(), err)
				}
				log.Warn("serving legacy storage", "resource", gr.String(), "error", err)
				storage = legacyStorage
			} else if legacyStorage == nil {
				log.Debug("Skipping dual writer; no legacy storage", "resource", gr.String(), "version", v, "storagePath", storagePath)
			} else {
				storage, err = s.dualWriteService.NewStorage(gr, legacyStorage, unifiedStorage)
				if err != nil {
					return err
				}
			}
		} else if statusRest, ok := storage.(*appsdkapiserver.StatusREST); ok {
			parentPath := strings.TrimSuffix(storagePath, "/status")
			parentStore, ok := apiGroupInfo.VersionedResourcesStorageMap[v][parentPath]
			if ok {
				if _, isMode4or5 := parentStore.(*genericregistry.Store); !isMode4or5 {
					// When legacy resources have status, the dual writing must be handled explicitly
					if statusProvider, ok := s.installer.(LegacyStatusProvider); ok {
						storage = statusProvider.GetLegacyStatus(gr.WithVersion(v), statusRest)
					} else {
						log.Warn("skipped registering status sub-resource that does not support dual writing",
							"resource", gr.String(), "version", v, "storagePath", storagePath)
						return nil
					}
				}
			}
		}
	}
	apiGroupInfo.VersionedResourcesStorageMap[v][storagePath] = storage
	return nil
}

// resourceFromStoragePath returns the top-level resource of a storage path, dropping any
// subresource suffix (e.g. "dashboards/status" → "dashboards").
func resourceFromStoragePath(storagePath string) string {
	resource, _, _ := strings.Cut(storagePath, "/")
	return resource
}

func (s *serverWrapper) configureStorage(gr schema.GroupResource, dualWriteSupported bool, storage genericrest.Storage) genericrest.Storage {
	log := logging.FromContext(s.ctx)

	if gs, ok := storage.(*genericregistry.Store); ok {
		// if dual write is supported, we need to modify the update strategy
		// this is not needed for the status store
		if dualWriteSupported {
			gs.UpdateStrategy = &updateStrategyWrapper{
				RESTUpdateStrategy: gs.UpdateStrategy,
			}
		}

		// Check if resource is namespace-scoped or cluster-scoped
		isNamespaced := gs.CreateStrategy != nil && gs.CreateStrategy.NamespaceScoped()
		if isNamespaced {
			gs.KeyFunc = grafanaregistry.NamespaceKeyFunc(gr)
			gs.KeyRootFunc = grafanaregistry.KeyRootFunc(gr)

			// check if the app provides a custom storage authorizer for namespace-scoped resources
			if provider, ok := s.installer.(NamespaceScopedStorageAuthorizerProvider); ok {
				authz := provider.GetNamespaceScopedStorageAuthorizer(gr)
				if authz != nil {
					return storewrapper.New(gs, gr, authz)
				}
			}

			return gs
		}

		// Case for Cluster Scoped resources.
		// Require explicit opt-in via ClusterScopedStorageAuthorizerProvider
		gs.KeyFunc = grafanaregistry.ClusterScopedKeyFunc(gr)
		gs.KeyRootFunc = grafanaregistry.ClusterKeyRootFunc(gr)

		// Check if the app provides a custom storage authorizer
		var authz storewrapper.ResourceStorageAuthorizer
		if provider, ok := s.installer.(ClusterScopedStorageAuthorizerProvider); ok {
			authz = provider.GetClusterScopedStorageAuthorizer(gr)
			if authz != nil {
				log.Debug("Using app-provided storage authorizer for cluster-scoped resource",
					"resource", gr.String())
			}
		}

		if authz == nil {
			// No authorizer provided - use deny authorizer for safety
			log.Warn("No storage authorizer provided for cluster-scoped resource, using deny authorizer. "+
				"Implement ClusterScopedStorageAuthorizerProvider to provide explicit authorization.",
				"resource", gr.String(),
				"app", s.installer.ManifestData().AppName)
			authz = &storewrapper.DenyAuthorizer{}
		}

		return storewrapper.New(gs, gr, authz)
	}

	// if the storage is a status store, we need to extract the underlying generic registry store
	if statusStore, ok := storage.(*appsdkapiserver.StatusREST); ok {
		isClusterScoped := statusStore.Store.UpdateStrategy != nil && !statusStore.Store.UpdateStrategy.NamespaceScoped()

		statusStore.Store.KeyFunc = grafanaregistry.NamespaceKeyFunc(gr)
		statusStore.Store.KeyRootFunc = grafanaregistry.KeyRootFunc(gr)
		if isClusterScoped {
			statusStore.Store.KeyFunc = grafanaregistry.ClusterScopedKeyFunc(gr)
			statusStore.Store.KeyRootFunc = grafanaregistry.ClusterKeyRootFunc(gr)
			// Note: StatusREST for cluster-scoped resources relies on API-level authorization.
			// Storage-level wrapping is not applied here since StatusREST uses the Store directly.
			// The parent resource's ClusterScopedStorageAuthorizerProvider handles main resource authorization.
			if _, ok := s.installer.(ClusterScopedStorageAuthorizerProvider); !ok {
				log.Warn("Cluster-scoped status subresource without explicit ClusterScopedStorageAuthorizerProvider. "+
					"Authorization relies on API-level authorizer only.",
					"resource", gr.String(),
					"app", s.installer.ManifestData().AppName)
			}
		}
		return statusStore
	}

	// if the storage is a subresource store, we need to extract the underlying generic registry store
	if subresourceStore, ok := storage.(*appsdkapiserver.SubresourceREST); ok {
		isClusterScoped := subresourceStore.Store.UpdateStrategy != nil && !subresourceStore.Store.UpdateStrategy.NamespaceScoped()

		subresourceStore.Store.KeyFunc = grafanaregistry.NamespaceKeyFunc(gr)
		subresourceStore.Store.KeyRootFunc = grafanaregistry.KeyRootFunc(gr)
		if isClusterScoped {
			subresourceStore.Store.KeyFunc = grafanaregistry.ClusterScopedKeyFunc(gr)
			subresourceStore.Store.KeyRootFunc = grafanaregistry.ClusterKeyRootFunc(gr)
			// Note: SubresourceREST for cluster-scoped resources relies on API-level authorization.
			// Storage-level wrapping is not applied here since SubresourceREST uses the Store directly.
			// The parent resource's ClusterScopedStorageAuthorizerProvider handles main resource authorization.
			if _, ok := s.installer.(ClusterScopedStorageAuthorizerProvider); !ok {
				log.Warn("Cluster-scoped subresource without explicit ClusterScopedStorageAuthorizerProvider. "+
					"Authorization relies on API-level authorizer only.",
					"resource", gr.String(),
					"app", s.installer.ManifestData().AppName)
			}
		}
		return subresourceStore
	}

	return storage
}

func (s *serverWrapper) RegisteredWebServices() []*restful.WebService {
	return s.GenericAPIServer.RegisteredWebServices()
}
