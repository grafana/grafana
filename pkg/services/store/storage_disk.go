package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/filestorage"
	"gocloud.dev/blob"
)

const rootStorageTypeDisk = "disk"

type rootStorageDisk struct {
	rootStorageState

	settings *StorageLocalDiskConfig
}

func newDiskStorage(name string, prefix string, cfg *StorageLocalDiskConfig) *rootStorageDisk {
	if cfg == nil {
		cfg = &StorageLocalDiskConfig{}
	}

	meta := RootStorageMeta{
		Config: RootStorageConfig{
			Type:   rootStorageTypeDisk,
			Prefix: prefix,
			Name:   name,
			Disk:   cfg,
		},
	}
	if prefix == "" {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Missing prefix",
		})
	}
	if cfg.Path == "" {
		meta.Notice = append(meta.Notice, data.Notice{
			Severity: data.NoticeSeverityError,
			Text:     "Missing path configuration",
		})
	}
	s := &rootStorageDisk{}
	s.Meta = meta
	s.settings = cfg

	if meta.Notice == nil {
		path := fmt.Sprintf("file://%s", cfg.Path)
		bucket, err := blob.OpenBucket(context.Background(), path)
		if err != nil {
			meta.Notice = append(meta.Notice, data.Notice{
				Severity: data.NoticeSeverityError,
				Text:     "Failed to initalize storage",
			})
		} else {
			s.Store = filestorage.NewCdkBlobStorage(grafanaStorageLogger,
				bucket, "",
				filestorage.NewPathFilters(cfg.Roots))

			meta.Ready = true // exists!
		}
	}

	return s
}

func newPublicFolder(root string) *rootStorageDisk {
	return newDiskStorage("public", "Public static files", &StorageLocalDiskConfig{
		Path: root,
		Roots: []string{
			"testdata/",
			"img/icons/",
			"img/bg/",
			"gazetteer/",
			"maps/",
			"upload/",
		},
	})
}
