// SPDX-License-Identifier: AGPL-3.0-only

package file

import (
	"fmt"
	goos "os"
	"path/filepath"
	"time"

	"github.com/hack-pad/hackpadfs"
	"github.com/hack-pad/hackpadfs/os"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	flowcontrolrequest "k8s.io/apiserver/pkg/util/flowcontrol/request"
)

var _ generic.RESTOptionsGetter = (*RESTOptionsGetter)(nil)

type RESTOptionsGetter struct {
	fs       hackpadfs.FS
	original storagebackend.Config
}

func NewWriteableFS(path string) (hackpadfs.FS, error) {
	path, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("invalid path")
	}
	path = filepath.Clean(path)
	_, err = goos.Stat(path)
	if err != nil {
		err = goos.MkdirAll(path, 0700)
	}
	if err != nil {
		return nil, fmt.Errorf("could not establish a writable directory at path=%s", path)
	}
	return os.NewFS().Sub(path[1:]) // remove leading "/"
}

func NewRESTOptionsGetter(fs hackpadfs.FS, originalStorageConfig storagebackend.Config) *RESTOptionsGetter {
	return &RESTOptionsGetter{fs: fs, original: originalStorageConfig}
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
		StorageConfig:           storageConfig,
		Decorator:               r.NewStorage,
		DeleteCollectionWorkers: 0,
		EnableGarbageCollection: false,
		// k8s expects forward slashes here, we'll convert them to os path separators in the storage
		ResourcePrefix:            "/" + resource.Group + "/" + resource.Resource,
		CountMetricPollPeriod:     1 * time.Second,
		StorageObjectCountTracker: storageConfig.Config.StorageObjectCountTracker,
	}

	return ret, nil
}
