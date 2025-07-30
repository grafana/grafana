package appinstaller

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	genericapiserver "k8s.io/apiserver/pkg/server"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/logging"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
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
	legacyProvider, hasLegacyProvider := s.installer.(LegacyStorageProvider)
	for v, storageMap := range apiGroupInfo.VersionedResourcesStorageMap {
		for storagePath, restStorage := range storageMap {
			genericStorage, ok := restStorage.(*genericregistry.Store)
			if !ok {
				log.Error("Expected generic registry store", "storagePath", storagePath, "version", v)
				continue
			}
			resource, err := getResourceFromStoragePath(storagePath)
			if err != nil {
				return err
			}
			gr := schema.GroupResource{
				Group:    s.installer.ManifestData().Group,
				Resource: resource,
			}
			// Update key functions for the storage
			genericStorage.KeyRootFunc = grafanaregistry.KeyRootFunc(gr)
			genericStorage.KeyFunc = grafanaregistry.NamespaceKeyFunc(gr)
			genericStorage.UpdateStrategy = &updateStrategyWrapper{
				RESTUpdateStrategy: genericStorage.UpdateStrategy,
			}

			// If there's a legacy provider, set up the dual writer
			if hasLegacyProvider {
				dw, err := NewDualWriter(
					s.ctx,
					gr,
					s.storageOpts,
					legacyProvider.GetLegacyStorage(gr.WithVersion(v)),
					grafanarest.Storage(genericStorage),
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
				apiGroupInfo.VersionedResourcesStorageMap[v][storagePath] = dw
			} else {
				apiGroupInfo.VersionedResourcesStorageMap[v][storagePath] = genericStorage
			}
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
