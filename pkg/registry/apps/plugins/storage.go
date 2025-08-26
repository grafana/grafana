package plugins

import (
	"fmt"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericserver "k8s.io/apiserver/pkg/server"
)

var _ appsdkapiserver.GenericAPIServer = (*customStorageWrapper)(nil)

type customStorageWrapper struct {
	wrapped appsdkapiserver.GenericAPIServer
	replace map[schema.GroupVersionResource]rest.Storage
}

func (c *customStorageWrapper) InstallAPIGroup(
	apiGroupInfo *genericserver.APIGroupInfo,
) error {
	if apiGroupInfo == nil || apiGroupInfo.VersionedResourcesStorageMap == nil {
		return fmt.Errorf("apiGroupInfo cannot be nil")
	}
	for gvr, storage := range c.replace {
		if _, ok := apiGroupInfo.VersionedResourcesStorageMap[gvr.Version]; !ok {
			apiGroupInfo.VersionedResourcesStorageMap[gvr.Version] = map[string]rest.Storage{}
		}
		apiGroupInfo.VersionedResourcesStorageMap[gvr.Version][gvr.Resource] = storage
	}
	return c.wrapped.InstallAPIGroup(apiGroupInfo)
}
