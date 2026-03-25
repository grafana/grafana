package app

import (
	"fmt"

	restful "github.com/emicklei/go-restful/v3"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericserver "k8s.io/apiserver/pkg/server"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
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

	// Override NegotiatedSerializer to only support JSON encoding
	// This prevents protobuf marshalling errors since our generated types
	// don't implement the protobuf marshalling interface
	if apiGroupInfo.NegotiatedSerializer != nil && apiGroupInfo.Scheme != nil {
		apiGroupInfo.NegotiatedSerializer = NewJSONOnlyNegotiatedSerializer(
			apiGroupInfo.Scheme,
			apiGroupInfo.NegotiatedSerializer,
		)
	}

	for gvr, storage := range c.replace {
		if _, ok := apiGroupInfo.VersionedResourcesStorageMap[gvr.Version]; !ok {
			apiGroupInfo.VersionedResourcesStorageMap[gvr.Version] = map[string]rest.Storage{}
		}
		apiGroupInfo.VersionedResourcesStorageMap[gvr.Version][gvr.Resource] = storage
	}
	return c.wrapped.InstallAPIGroup(apiGroupInfo)
}

// RegisteredWebServices implements apiserver.GenericAPIServer.
func (c *customStorageWrapper) RegisteredWebServices() []*restful.WebService {
	return []*restful.WebService{}
}
