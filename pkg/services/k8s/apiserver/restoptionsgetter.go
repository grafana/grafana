package apiserver

import (
	"path"
	"time"

	"github.com/grafana/grafana-apiserver/pkg/storage/filepath"
	"github.com/grafana/kindsys"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	flowcontrolrequest "k8s.io/apiserver/pkg/util/flowcontrol/request"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/setting"
)

type RESTOptionsGetter struct {
	store    entity.EntityStoreServer
	codec    runtime.Codec
	registry *corekind.Base

	fallback generic.RESTOptionsGetter
}

func ProvideRESTOptionsGetter(cfg *setting.Cfg, features featuremgmt.FeatureToggles, store entity.EntityStoreServer, registry *corekind.Base) func(runtime.Codec) generic.RESTOptionsGetter {
	return func(codec runtime.Codec) generic.RESTOptionsGetter {
		// Default to a file based solution
		fallback := filepath.NewRESTOptionsGetter(path.Join(cfg.DataPath, "k8s"), codec)

		if !features.IsEnabled(featuremgmt.FlagEntityStore) {
			return fallback
		}
		return &RESTOptionsGetter{
			store:    store,
			registry: registry,
			codec:    codec,
			fallback: fallback,
		}
	}
}

func (f *RESTOptionsGetter) GetRESTOptions(resource schema.GroupResource) (generic.RESTOptions, error) {
	if resource.Resource == "grafanakinds" {
		return f.fallback.GetRESTOptions(resource)
	}

	storageConfig := &storagebackend.ConfigForResource{
		Config: storagebackend.Config{
			Type:                      "custom",
			Prefix:                    "",
			Transport:                 storagebackend.TransportConfig{},
			Paging:                    false,
			Codec:                     f.codec,
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

			var found kindsys.Core
			kinds := f.registry.All()
			for _, k := range kinds {
				if k.Props().Common().PluralMachineName == config.GroupResource.Resource {
					found = k
					break
				}
			}

			// implement this function with something like https://github.com/grafana/grafana-apiserver/blob/7a585ef1a6b082e4d164188f03e666f6df1d2ba1/pkg/storage/filepath/storage.go#L43
			return NewEntityStorage(f.store,
				found,
				config, resourcePrefix,
				keyFunc, newFunc, newListFunc,
				getAttrsFunc, trigger, indexers,
			)
		},
		DeleteCollectionWorkers: 0,
		EnableGarbageCollection: false,
		ResourcePrefix:          path.Join(storageConfig.Prefix, resource.Group, resource.Resource),
		// NOTE: CountMetricPollPeriod > 0 starts a metric collector at KeyRootFunc for this group resource
		// https://github.com/kubernetes/apiserver/blob/v0.27.2/pkg/registry/generic/registry/store.go#L1490
		CountMetricPollPeriod:     0 * time.Second,
		StorageObjectCountTracker: flowcontrolrequest.NewStorageObjectCountTracker(),
	}

	return ret, nil
}
