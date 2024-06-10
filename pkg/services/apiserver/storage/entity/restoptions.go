// SPDX-License-Identifier: AGPL-3.0-only

package entity

import (
	"encoding/json"
	"path"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	flowcontrolrequest "k8s.io/apiserver/pkg/util/flowcontrol/request"
	"k8s.io/client-go/tools/cache"

	entityStore "github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/setting"
)

var _ generic.RESTOptionsGetter = (*RESTOptionsGetter)(nil)

type RESTOptionsGetter struct {
	cfg   *setting.Cfg
	store entityStore.EntityStoreClient
	Codec runtime.Codec
}

func NewRESTOptionsGetter(cfg *setting.Cfg, store entityStore.EntityStoreClient, codec runtime.Codec) *RESTOptionsGetter {
	return &RESTOptionsGetter{
		cfg:   cfg,
		store: store,
		Codec: codec,
	}
}

func (f *RESTOptionsGetter) GetRESTOptions(resource schema.GroupResource) (generic.RESTOptions, error) {
	// build connection string to uniquely identify the storage backend
	connectionInfo, err := json.Marshal(f.cfg.SectionWithEnvOverrides("entity_api").KeysHash())
	if err != nil {
		return generic.RESTOptions{}, err
	}

	storageConfig := &storagebackend.ConfigForResource{
		Config: storagebackend.Config{
			Type:   "custom",
			Prefix: "",
			Transport: storagebackend.TransportConfig{
				ServerList: []string{
					string(connectionInfo),
				},
			},
			Codec:                     f.Codec,
			EncodeVersioner:           nil,
			Transformer:               nil,
			CompactionInterval:        0,
			CountMetricPollPeriod:     0,
			DBMetricPollInterval:      0,
			HealthcheckTimeout:        0,
			ReadycheckTimeout:         0,
			StorageObjectCountTracker: nil,
		},
		GroupResource: resource,
	}

	ret := generic.RESTOptions{
		StorageConfig: storageConfig,
		Decorator: func(
			config *storagebackend.ConfigForResource,
			resourcePrefix string,
			keyFunc func(obj runtime.Object) (string, error),
			newFunc func() runtime.Object,
			newListFunc func() runtime.Object,
			getAttrsFunc storage.AttrFunc,
			trigger storage.IndexerFuncs,
			indexers *cache.Indexers,
		) (storage.Interface, factory.DestroyFunc, error) {
			return NewStorage(config, resource, f.store, f.Codec, keyFunc, newFunc, newListFunc, getAttrsFunc)
		},
		DeleteCollectionWorkers:   0,
		EnableGarbageCollection:   false,
		ResourcePrefix:            path.Join(storageConfig.Prefix, resource.Group, resource.Resource),
		CountMetricPollPeriod:     1 * time.Second,
		StorageObjectCountTracker: flowcontrolrequest.NewStorageObjectCountTracker(),
	}

	return ret, nil
}
