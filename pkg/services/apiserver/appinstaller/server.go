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
	log := logging.FromContext(s.ctx)
	for v, storageMap := range apiGroupInfo.VersionedResourcesStorageMap {
		for storagePath, restStorage := range storageMap {
			legacyProvider, dualWriteSupported := s.installer.(LegacyStorageProvider)
			resource, err := getResourceFromStoragePath(storagePath)
			if err != nil {
				return err
			}
			gr := schema.GroupResource{
				Group:    s.installer.ManifestData().Group,
				Resource: resource,
			}
			gvr := gr.WithVersion(v)
			if s.apiResourceConfig != nil && !s.apiResourceConfig.ResourceEnabled(gvr) {
				log.Debug("Skipping storage for disabled resource", "gvr", gvr.String(), "storagePath", storagePath)
				delete(apiGroupInfo.VersionedResourcesStorageMap[v], storagePath)
				continue
			}
			storage := s.configureStorage(gr, dualWriteSupported, restStorage)
			if dualWriteSupported {
				if unifiedStorage, ok := storage.(grafanarest.Storage); ok {
					log.Debug("Configuring dual writer for storage", "resource", gr.String(), "version", v, "storagePath", storagePath)
					storage, err = NewDualWriter(
						gr,
						s.storageOpts,
						legacyProvider.GetLegacyStorage(gr.WithVersion(v)),
						unifiedStorage,
						s.dualWriteService,
						s.builderMetrics,
					)
					if err != nil {
						return err
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
								continue
							}
						}
					}
				}
			}
			apiGroupInfo.VersionedResourcesStorageMap[v][storagePath] = storage
		}
	}

	return s.GenericAPIServer.InstallAPIGroup(apiGroupInfo)
}

func getResourceFromStoragePath(storagePath string) (string, error) {
	parts := strings.Split(storagePath, "/")
	if len(parts) < 1 {
		return "", fmt.Errorf("invalid storage path: %s", storagePath)
	}
	return parts[0], nil
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
					return storewrapper.New(gs, authz)
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

		return storewrapper.New(gs, authz)
	}

	// if the storage is a status store, we need to extract the underlying generic registry store
	if statusStore, ok := storage.(*appsdkapiserver.StatusREST); ok {
		isClusterScoped := statusStore.Store.CreateStrategy != nil && !statusStore.Store.CreateStrategy.NamespaceScoped()

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
		isClusterScoped := subresourceStore.Store.CreateStrategy != nil && !subresourceStore.Store.CreateStrategy.NamespaceScoped()

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
