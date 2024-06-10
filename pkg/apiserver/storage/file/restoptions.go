// SPDX-License-Identifier: AGPL-3.0-only

package file

import (
	"os"
	"path/filepath"
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

// Optionally, this constructor allows specifying directories
// for resources that are required to be read/watched on startup and there
// won't be any write operations that initially bootstrap their directories
func NewRESTOptionsGetter(path string,
	originalStorageConfig storagebackend.Config,
	createResourceDirs ...string) (*RESTOptionsGetter, error) {
	if path == "" {
		path = filepath.Join(os.TempDir(), "grafana-apiserver")
	}

	if err := initializeDirs(path, createResourceDirs); err != nil {
		return nil, err
	}

	return &RESTOptionsGetter{path: path, original: originalStorageConfig}, nil
}

func initializeDirs(root string, createResourceDirs []string) error {
	for _, dir := range createResourceDirs {
		if err := ensureDir(filepath.Join(root, dir)); err != nil {
			return err
		}
	}
	return nil
}

func (r *RESTOptionsGetter) GetRESTOptions(resource schema.GroupResource) (generic.RESTOptions, error) {
	storageConfig := &storagebackend.ConfigForResource{
		Config: storagebackend.Config{
			Type:                      "file",
			Prefix:                    r.path,
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
		StorageConfig:           storageConfig,
		Decorator:               NewStorage,
		DeleteCollectionWorkers: 0,
		EnableGarbageCollection: false,
		// k8s expects forward slashes here, we'll convert them to os path separators in the storage
		ResourcePrefix:            "/" + resource.Group + "/" + resource.Resource,
		CountMetricPollPeriod:     1 * time.Second,
		StorageObjectCountTracker: storageConfig.Config.StorageObjectCountTracker,
	}

	return ret, nil
}
