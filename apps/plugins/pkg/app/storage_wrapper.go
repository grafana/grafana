package app

import (
	"fmt"

	"github.com/emicklei/go-restful/v3"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericserver "k8s.io/apiserver/pkg/server"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

var _ appsdkapiserver.GenericAPIServer = (*customStorageWrapper)(nil)

type customStorageWrapper struct {
	wrapped appsdkapiserver.GenericAPIServer
	replace map[schema.GroupVersionResource]rest.Storage
	wrap    map[schema.GroupVersionResource]func(rest.Storage) (rest.Storage, error)
}

func (c *customStorageWrapper) InstallAPIGroup(
	apiGroupInfo *genericserver.APIGroupInfo,
) error {
	if apiGroupInfo == nil || apiGroupInfo.VersionedResourcesStorageMap == nil {
		return fmt.Errorf("apiGroupInfo cannot be nil")
	}

	// Override NegotiatedSerializer to exclude protobuf support.
	// Our generated types do not implement protobuf encoding, so we exclude protobuf
	// to prevent namespace deletion failures and marshalling errors.
	// See: https://github.com/kubernetes/kubernetes/issues/86666
	if apiGroupInfo.NegotiatedSerializer != nil {
		apiGroupInfo.NegotiatedSerializer = &noProtobufWrapper{apiGroupInfo.NegotiatedSerializer}
	}

	for gvr, storage := range c.replace {
		if _, ok := apiGroupInfo.VersionedResourcesStorageMap[gvr.Version]; !ok {
			apiGroupInfo.VersionedResourcesStorageMap[gvr.Version] = map[string]rest.Storage{}
		}
		apiGroupInfo.VersionedResourcesStorageMap[gvr.Version][gvr.Resource] = storage
	}
	for gvr, wrap := range c.wrap {
		versionedStorage, ok := apiGroupInfo.VersionedResourcesStorageMap[gvr.Version]
		if !ok {
			return fmt.Errorf("storage version %q not found for %s", gvr.Version, gvr.String())
		}
		storage, ok := versionedStorage[gvr.Resource]
		if !ok {
			return fmt.Errorf("storage resource %q not found for %s", gvr.Resource, gvr.String())
		}
		wrappedStorage, err := wrap(storage)
		if err != nil {
			return err
		}
		versionedStorage[gvr.Resource] = wrappedStorage
	}
	return c.wrapped.InstallAPIGroup(apiGroupInfo)
}

type noProtobufWrapper struct {
	runtime.NegotiatedSerializer
}

func (w *noProtobufWrapper) SupportedMediaTypes() []runtime.SerializerInfo {
	base := w.NegotiatedSerializer.SupportedMediaTypes()
	var supported []runtime.SerializerInfo
	for _, info := range base {
		if grafanarest.NoProtobuf(info) {
			supported = append(supported, info)
		}
	}
	return supported
}

// RegisteredWebServices implements apiserver.GenericAPIServer. It passes through
// to the wrapped server: this wrapper only customizes storage in InstallAPIGroup
// and must stay transparent for everything else. Returning an empty slice here
// would make app-sdk fail to find the version WebService when registering
// custom resource routes.
func (c *customStorageWrapper) RegisteredWebServices() []*restful.WebService {
	return c.wrapped.RegisteredWebServices()
}
