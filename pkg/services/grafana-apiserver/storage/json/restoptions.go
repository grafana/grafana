// SPDX-License-Identifier: AGPL-3.0-only

package json

import (
	"path"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	flowcontrolrequest "k8s.io/apiserver/pkg/util/flowcontrol/request"
)

var _ generic.RESTOptionsGetter = (*RESTOptionsGetter)(nil)

type RESTOptionsGetter struct {
	path     string
	original storagebackend.Config
}

func NewRESTOptionsGetter(path string, originalStorageConfig storagebackend.Config) *RESTOptionsGetter {
	if path == "" {
		path = "/tmp/grafana-apiserver"
	}

	return &RESTOptionsGetter{path: path, original: originalStorageConfig}
}

func (r *RESTOptionsGetter) GetRESTOptions(resource schema.GroupResource) (generic.RESTOptions, error) {
	storageConfig := &storagebackend.ConfigForResource{
		Config: storagebackend.Config{
			Type:                      "json",
			Prefix:                    r.path,
			Transport:                 storagebackend.TransportConfig{},
			Paging:                    false,
			Codec:                     r.original.Codec,
			EncodeVersioner:           r.original.EncodeVersioner,
			Transformer:               r.original.Transformer,
			CompactionInterval:        0,
			CountMetricPollPeriod:     0,
			DBMetricPollInterval:      0,
			HealthcheckTimeout:        0,
			ReadycheckTimeout:         0,
			StorageObjectCountTracker: flowcontrolrequest.NewStorageObjectCountTracker(),
		},
		GroupResource: resource,
	}

	ret := generic.RESTOptions{
		StorageConfig:             storageConfig,
		Decorator:                 NewStorage,
		DeleteCollectionWorkers:   0,
		EnableGarbageCollection:   false,
		ResourcePrefix:            path.Join(storageConfig.Prefix, resource.Group, resource.Resource),
		CountMetricPollPeriod:     1 * time.Second,
		StorageObjectCountTracker: storageConfig.Config.StorageObjectCountTracker,
	}

	return ret, nil
}
