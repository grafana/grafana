package apiserver

import (
	"path"
	"time"

	"github.com/grafana/grafana-apiserver/pkg/storage/filepath"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	flowcontrolrequest "k8s.io/apiserver/pkg/util/flowcontrol/request"
)

type RESTOptionsGetter struct {
	features featuremgmt.FeatureToggles
	store    entity.EntityStoreServer
	codec    runtime.Codec
}

func ProvideRESTOptionsGetter(cfg *setting.Cfg, features featuremgmt.FeatureToggles, store entity.EntityStoreServer) func(runtime.Codec) generic.RESTOptionsGetter {
	return func(codec runtime.Codec) generic.RESTOptionsGetter {
		if true {
			return filepath.NewRESTOptionsGetter(path.Join(cfg.DataPath, "k8s"), codec)
		}
		return &RESTOptionsGetter{features: features, store: store, codec: codec}
	}
}

func (f *RESTOptionsGetter) GetRESTOptions(resource schema.GroupResource) (generic.RESTOptions, error) {
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
		StorageConfig:             storageConfig,
		Decorator:                 nil, // implement this function with something like https://github.com/grafana/grafana-apiserver/blob/7a585ef1a6b082e4d164188f03e666f6df1d2ba1/pkg/storage/filepath/storage.go#L43
		DeleteCollectionWorkers:   0,
		EnableGarbageCollection:   false,
		ResourcePrefix:            path.Join(storageConfig.Prefix, resource.Group, resource.Resource),
		CountMetricPollPeriod:     1 * time.Second,
		StorageObjectCountTracker: flowcontrolrequest.NewStorageObjectCountTracker(),
	}

	return ret, nil
}
