package appinstaller

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	genericrest "k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/logging"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	grafanaapiserveroptions "github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

var _ appsdkapiserver.GenericAPIServer = (*serverWrapper)(nil)

type serverWrapper struct {
	ctx context.Context
	appsdkapiserver.GenericAPIServer
	installer         appsdkapiserver.AppInstaller
	restOptionsGetter generic.RESTOptionsGetter
	storageOpts       *grafanaapiserveroptions.StorageOptions
	kvStore           grafanarest.NamespacedKVStore
	lock              serverLock
	namespaceMapper   request.NamespaceMapper
	dualWriteService  dualwrite.Service
	dualWriterMetrics *grafanarest.DualWriterMetrics
	builderMetrics    *builder.BuilderMetrics
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
			storage := s.configureStorage(gr, dualWriteSupported, restStorage)
			if unifiedStorage, ok := storage.(rest.Storage); ok && dualWriteSupported {
				log.Debug("Configuring dual writer for storage", "resource", gr.String(), "version", v, "storagePath", storagePath)
				dw, err := NewDualWriter(
					s.ctx,
					gr,
					s.storageOpts,
					legacyProvider.GetLegacyStorage(gr.WithVersion(v)),
					grafanarest.Storage(unifiedStorage),
					s.kvStore,
					s.lock,
					s.namespaceMapper,
					s.dualWriteService,
					s.dualWriterMetrics,
					s.builderMetrics,
				)
				if err != nil {
					return err
				}
				storage = dw
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
	if gs, ok := storage.(*genericregistry.Store); ok {
		// if dual write is supported, we need to modify the update strategy
		// this is not needed for the status store
		if dualWriteSupported {
			gs.UpdateStrategy = &updateStrategyWrapper{
				RESTUpdateStrategy: gs.UpdateStrategy,
			}
		}
		gs.KeyFunc = grafanaregistry.NamespaceKeyFunc(gr)
		gs.KeyRootFunc = grafanaregistry.KeyRootFunc(gr)
		return gs
	}

	// if the storage is a status store, we need to extract the underlying generic registry store
	if statusStore, ok := storage.(*appsdkapiserver.StatusREST); ok {
		statusStore.Store.KeyFunc = grafanaregistry.NamespaceKeyFunc(gr)
		statusStore.Store.KeyRootFunc = grafanaregistry.KeyRootFunc(gr)
		return statusStore
	}

	return storage
}
