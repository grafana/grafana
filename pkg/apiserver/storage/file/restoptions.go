// SPDX-License-Identifier: AGPL-3.0-only

package file

import (
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	flowcontrolrequest "k8s.io/apiserver/pkg/util/flowcontrol/request"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

var _ generic.RESTOptionsGetter = (*RESTOptionsGetter)(nil)

type RESTOptionsGetter struct {
	store    resource.ResourceStoreClient
	original storagebackend.Config
}

// Optionally, this constructor allows specifying directories
// for resources that are required to be read/watched on startup and there
// won't be any write operations that initially bootstrap their directories
func NewRESTOptionsGetter(store resource.ResourceStoreClient,
	originalStorageConfig storagebackend.Config,
) (*RESTOptionsGetter, error) {
	return &RESTOptionsGetter{store: store, original: originalStorageConfig}, nil
}

func (r *RESTOptionsGetter) GetRESTOptions(resource schema.GroupResource) (generic.RESTOptions, error) {
	storageConfig := &storagebackend.ConfigForResource{
		Config: storagebackend.Config{
			Type:                      "file",
			Transport:                 storagebackend.TransportConfig{},
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
		StorageConfig: storageConfig,
		///Decorator:               NewStorage,
		DeleteCollectionWorkers: 0,
		EnableGarbageCollection: false,
		// k8s expects forward slashes here, we'll convert them to os path separators in the storage
		ResourcePrefix:            "/group/" + resource.Group + "/resource/" + resource.Resource,
		CountMetricPollPeriod:     1 * time.Second,
		StorageObjectCountTracker: storageConfig.Config.StorageObjectCountTracker,
	}

	return ret, nil
}
