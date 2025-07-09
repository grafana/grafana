package appinstaller

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
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
	legacyProvider, ok := s.installer.(LegacyStorageProvider)
	if !ok {
		return s.GenericAPIServer.InstallAPIGroup(apiGroupInfo)
	}
	for v, storageMap := range apiGroupInfo.VersionedResourcesStorageMap {
		for storagePath, restStorage := range storageMap {
			grafanaStorage, ok := restStorage.(grafanarest.Storage)
			if !ok {
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
			dw, err := NewDualWriter(
				s.ctx,
				gr,
				s.storageOpts,
				legacyProvider.GetLegacyStorage(gr.WithVersion(v)),
				grafanaStorage,
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
